import {
  AccountInterface,
  Contract,
  BigNumberish,
  CallData,
  TypedData,
  cairo,
  Abi,
  num,
} from "starknet";

import {
  Call,
  CreateAccountOptions,
  AccountResult,
  GetAccountOptions,
  TokenboundClientOptions,
  GetOwnerOptions,
  ERC20TransferOptions,
  NFTTransferOptions,
  MultiCall,
  GetHasPermissionOptions,
  GetIsLockedOptions,
  SetPermissionOptions,
  LockAccountOptions,
  UpgradeOptions,
} from "./types/TokenboundClient";

import { accountClient } from "./utils/account";
import { getProvider } from "./utils/provider";

import { ERC_6551_DEPLOYMENTS, TBAVersion } from "./constants";

export class TokenboundClient {
  private account: AccountInterface;
  private jsonRPC: string;
  private registryAddress: string;
  private implementationAddress: string;
  private chain_id: string;
  public isInitialized: boolean = false;
  public registryAbi: Abi;
  public accountAbi: Abi;
  public supportsV3: boolean = true;

  constructor(options: TokenboundClientOptions) {
    const {
      walletClient,
      account,
      jsonRPC,
      registryAddress,
      implementationAddress,
      chain_id = "SN_SEPOLIA",
      version = TBAVersion.V3,
    } = options;

    if (account && walletClient) {
      throw new Error("only one of `account` or `walletClient` is required!");
    }
    account
      ? (this.account = account)
      : (this.account = accountClient(jsonRPC, walletClient));
    this.jsonRPC = jsonRPC;
    this.isInitialized = true;
    this.chain_id = chain_id;

    this.registryAddress =
      registryAddress ??
      ERC_6551_DEPLOYMENTS[chain_id][version].REGISTRY.ADDRESS;
    this.implementationAddress =
      implementationAddress ??
      ERC_6551_DEPLOYMENTS[chain_id][version].IMPLEMENTATION.ADDRESS;
    this.registryAbi = ERC_6551_DEPLOYMENTS[chain_id][version].REGISTRY.ABI;
    this.accountAbi =
      ERC_6551_DEPLOYMENTS[chain_id][version].IMPLEMENTATION.ABI;

    const isV2 = version && version === TBAVersion.V2;

    if (isV2) {
      this.supportsV3 = false;
    }
  }

  public async getAccount(params: GetAccountOptions) {
    const { tokenContract, tokenId, salt } = params;
    const provider = getProvider(this.jsonRPC);

    const contract = new Contract(
      this.registryAbi,
      this.registryAddress,
      provider
    );

    try {
      const payload = [
        this.implementationAddress,
        tokenContract,
        tokenId,
        salt ? salt : tokenId,
      ];

      if (this.supportsV3) {
        payload.push(this.chain_id);
      }

      const address: BigNumberish = await contract.get_account(...payload);
      return address;
    } catch (error) {
      throw error;
    }
  }

  public async createAccount({
    tokenContract,
    tokenId,
    salt,
  }: CreateAccountOptions): Promise<AccountResult> {
    const contract = new Contract(
      this.registryAbi,
      this.registryAddress,
      this.account
    );
    const salt_arg = salt || tokenId;
    try {
      const payload = [
        this.implementationAddress,
        tokenContract,
        cairo.uint256(tokenId),
        salt_arg,
      ];

      if (this.supportsV3) {
        payload.push(this.chain_id);
      }

      const result = await contract.create_account(...payload);

      const account = await this.getAccount({
        tokenContract,
        tokenId,
        salt: salt_arg,
      });

      return {
        transaction_hash: result?.transaction_hash.toString(),
        account: num.toHex(account),
      };
    } catch (error) {
      throw error;
    }
  }

  public async checkAccountDeployment(params: GetAccountOptions) {
    const { tokenContract, tokenId, salt } = params;
    const provider = getProvider(this.jsonRPC);

    let salt_arg = salt ? salt : tokenId;
    let address = await this.getAccount({
      tokenContract,
      tokenId,
      salt: salt_arg,
    });
    try {
      const classHash = await provider.getClassHashAt(address);
      if (classHash) {
        return { deployed: true, classHash };
      }
    } catch (error) {
      return { deployed: false, classHash: "" };
    }
  }

  public async execute(tbaAddress: string, calls: Call[]) {
    const provider = getProvider(this.jsonRPC);
    let call: MultiCall = {
      contractAddress: tbaAddress,
      entrypoint: this.supportsV3 ? "execute" : "__execute__",
      calldata: CallData.compile({ calls }),
    };

    try {
      const result = await this.account.execute(call);
      await provider.waitForTransaction(result.transaction_hash);
      return true;
    } catch (error) {
      throw error;
    }
  }

  public async getOwner(options: GetOwnerOptions) {
    let { tbaAddress } = options;
    const contract = new Contract(this.accountAbi, tbaAddress, this.account);
    try {
      let owner = await contract.owner();
      return owner;
    } catch (error) {
      throw error;
    }
  }

  public async getOwnerNFT(tbaAddress: string) {
    const contract = new Contract(this.accountAbi, tbaAddress, this.account);
    try {
      let ownerNFT = await contract.token();
      return ownerNFT;
    } catch (error) {
      throw error;
    }
  }

  public async transferERC20(options: ERC20TransferOptions) {
    const { tbaAddress, contractAddress, recipient, amount } = options;

    let call: Call = {
      to: contractAddress,
      selector:
        "0x83afd3f4caedc6eebf44246fe54e38c95e3179a5ec9ea81740eca5b482d12e",
      calldata: CallData.compile({
        recipient,
        amount: cairo.uint256(amount),
      }),
    };

    try {
      return await this.execute(tbaAddress, [call]);
    } catch (error) {
      throw error;
    }
  }

  public async transferNFT(options: NFTTransferOptions) {
    const { tbaAddress, contractAddress, tokenId, sender, recipient } = options;

    let call: Call = {
      to: contractAddress,
      selector:
        "0x41b033f4a31df8067c24d1e9b550a2ce75fd4a29e1147af9752174f0e6cb20",
      calldata: CallData.compile({
        from_: sender,
        to: recipient,
        amount: cairo.uint256(tokenId),
      }),
    };

    try {
      return await this.execute(tbaAddress, [call]);
    } catch (error) {
      throw error;
    }
  }

  public async signMessage(typedData: TypedData) {
    try {
      return await this.account.signMessage(typedData);
    } catch (error) {
      throw error;
    }
  }

  public async getPermission(options: GetHasPermissionOptions) {
    let { tbaAddress, owner, permissionedAddress } = options;
    const contract = new Contract(this.accountAbi, tbaAddress, this.account);
    try {
      if (!this.supportsV3) return null;
      return await contract.has_permission(owner, permissionedAddress);
    } catch (error) {
      throw error;
    }
  }

  public async setPermission(options: SetPermissionOptions) {
    let { tbaAddress, permissionedAddresses, permissions } = options;
    const contract = new Contract(this.accountAbi, tbaAddress, this.account);
    try {
      if (!this.supportsV3) return null;
      return await contract.set_permission(permissionedAddresses, permissions);
    } catch (error) {
      throw error;
    }
  }

  public async isLocked(options: GetIsLockedOptions) {
    let { tbaAddress } = options;
    const contract = new Contract(this.accountAbi, tbaAddress, this.account);
    try {
      return await contract.is_locked();
    } catch (error) {
      throw error;
    }
  }

  public async lock(options: LockAccountOptions) {
    let { tbaAddress, lockUntill } = options;
    const contract = new Contract(this.accountAbi, tbaAddress, this.account);
    try {
      return await contract.lock(lockUntill);
    } catch (error) {
      throw error;
    }
  }

  public async upgrade(options: UpgradeOptions) {
    let { tbaAddress, newClassHash } = options;
    const contract = new Contract(this.accountAbi, tbaAddress, this.account);
    try {
      if (!this.supportsV3) return null;
      return await contract.upgrade(newClassHash);
    } catch (error) {
      throw error;
    }
  }
}
