import React, { useEffect, useState } from "react";
import { num } from "starknet";
import { TokenboundClient, Call, TBAVersion, TBAChainID } from "starknet-tokenbound-sdk";
import { useAccount, useConnect } from "@starknet-react/core";
import FormatAddress from "./Address";
import { disconnect } from "starknetkit";

function Home() {
  const [deployStatus, setDeployStatus] = useState<boolean>();
  const [accountClassHash, setAccountClassHash] = useState<string>();
  const [tbaAccount, setTbaAccount] = useState<string | undefined>("");
  const [owner, setOwner] = useState<string>("");
  const [nftOwner, setNftOwner] = useState<string>();
  const [nftOwnerId, setNftOwnerId] = useState<string>();
  const [txHash, setTxHash] = useState<string>("");
  const [lockStatus, setLockStatus] = useState<boolean>();
  const [permissionStatus, setPermissionStatus] = useState<boolean | null>();
  const [timeUntilUnlocks, setTimeUntilUnlocks] = useState<string>();

  const V2_SALT = "240000000000";

  // replace with your own permissioned address
  const testPermissionedAddr: string =
    "0x04F1A720BC8D441139B9C27dff5Be5a740b310c8425abAC8da72C0609014E933";

  const { connect, connectors } = useConnect();
  const { address, account } = useAccount();

  const registryAddress: string =
    "0x23a6d289a1e5067d905e195056c322381a78a3bc9ab3b0480f542fad87cc580";
  const implementationAddress: string =
    "0x7396dc2e3ac3b50eac9b12447d7dcc2cfddef27405c680d46d6b13dae90d804";

  const [tokenbound, setTokenbound] = useState<TokenboundClient | null>(null);

  useEffect(() => {
    if (account) {
      const options = {
        account: account,
        registryAddress: registryAddress,
        implementationAddress: implementationAddress,
        version: TBAVersion.V3,
        chain_id: TBAChainID.main,
        jsonRPC: "https://free-rpc.nethermind.io/sepolia-juno/v0_7",
      };
      const client = new TokenboundClient(options);
      setTokenbound(client);
    }
  }, [account])

  const tokenContract =
    "0x0000003697660a0981d734780731949ecb2b4a38d6a58fc41629ed611e8defda";
  const tokenId = "50";
  const url = `https://sepolia.starkscan.co/contract/${account}`;

  const deployAccount = async () => {
    if (tokenbound) {
      try {
        const result = await tokenbound.createAccount({
          tokenContract: tokenContract,
          tokenId: tokenId,
          salt: V2_SALT,
        });

        setTxHash(result.transaction_hash.toString());
        setTbaAccount(result.account);
        alert("Account deployed successfully");
        console.log(result);
      } catch (error) {
        console.log(error);
      }
    }
  };

  const execute = async () => {
    const call1: Call = {
      to: "0x0388e9b2e37467b2b708ee930827177b42500f9b0e461fa3a059397dcf5a2e47",
      selector:
        "0x362398bec32bc0ebb411203221a35a0301193a96f317ebe5e40be9f60d15320",
      calldata: [10],
    };
    const call2: Call = {
      to: "0x0388e9b2e37467b2b708ee930827177b42500f9b0e461fa3a059397dcf5a2e47",
      selector:
        "0x362398bec32bc0ebb411203221a35a0301193a96f317ebe5e40be9f60d15320",
      calldata: [20],
    };
    try {
      await tokenbound?.execute(tbaAccount as string, [call1, call2]);
      alert("txn executed successfully!");
    } catch (error) {
      console.log(error);
    }
  };

  // transfer ETH to your tokenbound account and replace here
  const transferERC20 = async () => {
    const ETH_CONTRACT =
      "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";

    const recipient =
      "0x02d904Aedff382C0D68F22444B525146ec5eA2926e271fC411845e8D9E751DE1";

    try {
      await tokenbound?.transferERC20({
        tbaAddress: tbaAccount ?? "",
        contractAddress: ETH_CONTRACT,
        recipient,
        amount: "10000000000000",
      });

      alert("Transfer was successful");
    } catch (error) {
      console.log(error);
    }
  };

  // transfer an NFT to your tokenbound account and replace here
  const transferNFT = async () => {
    const NFT_CONTRACT =
      "0x035b9aa824b897d9327ccde535e142ba36c8afc4d13f1ab00390b476b919fa58";

    const TOKEN_ID = "197";

    const recipient =
      "0x02d904Aedff382C0D68F22444B525146ec5eA2926e271fC411845e8D9E751DE1";

    try {
      await tokenbound?.transferNFT({
        tbaAddress: tbaAccount ?? "",
        contractAddress: NFT_CONTRACT,
        tokenId: TOKEN_ID,
        sender: tbaAccount as string,
        recipient,
      });

      alert("Transfer was successful");
    } catch (error) {
      console.log(error);
    }
  };

  // replace with a valid timestamp
  const lockAccount = async () => {
    try {
      await tokenbound?.lock({
        tbaAddress: tbaAccount ?? "",
        lockUntill: 1728057939,
      });
      alert("Account was locked successfully");
    } catch (error) {
      console.log(error, "lock");
    }
  };

  // upgrades (or less) downgrades to V2
  const upgradeAccount = async () => {
    try {
      await tokenbound?.upgrade({
        newClassHash:
          "0x45d67b8590561c9b54e14dd309c9f38c4e2c554dd59414021f9d079811621bd",
        tbaAddress: tbaAccount ?? "",
      });
      alert("Account was upgraded successfully");
    } catch (error) {
      console.log(error);
    }
  };

  const setPermissions = async () => {
    try {
      await tokenbound?.setPermission({
        tbaAddress: tbaAccount ?? "",
        permissionedAddresses: [testPermissionedAddr],
        permissions: [true],
      });
      alert("Permissions added successfully");
    } catch (error) {
      console.log(error);
    }
  };


  useEffect(() => {
    if (tbaAccount && deployStatus) {
      const getAccountOwner = async () => {
        const nftowner = await tokenbound?.getOwner({
          tbaAddress: tbaAccount,
        });
        setOwner(num.toHex(nftowner));
      };
      const getNFTOwner = async () => {
        const nftowner = await tokenbound?.getOwnerNFT(tbaAccount as string);
        setNftOwner(num.toHex(nftowner[0]));
        setNftOwnerId(nftowner[1].toString());
      };

      getAccountOwner();
      getNFTOwner();
    }
  }, [tbaAccount, deployStatus]);



  useEffect(() => {
    if (tbaAccount && deployStatus) {
      const getLockStatus = async () => {
        const isLocked = await tokenbound?.isLocked({
          tbaAddress: tbaAccount,
        });
        setLockStatus(Boolean(isLocked[0]));
        setTimeUntilUnlocks(isLocked[1].toString());
      };
      const getAccountPermissions = async () => {
        const permission = await tokenbound?.getPermission({
          tbaAddress: tbaAccount,
          owner: owner,
          permissionedAddress: testPermissionedAddr,
        });

        if (permission != null) {
          setPermissionStatus(permission);
        }
      };
      getAccountPermissions();
      getLockStatus();
    }
  }, [tbaAccount, owner, deployStatus]);

  useEffect(() => {

    const getAccount = async () => {
      const account = await tokenbound?.getAccount({
        tokenContract: tokenContract,
        tokenId: tokenId,
        salt: V2_SALT,
      });

      setTbaAccount(num.toHexString(account ?? ""));
    };

    const getDeploymentStatus = async () => {
      const status = await tokenbound?.checkAccountDeployment({
        tokenContract,
        tokenId,
        salt: V2_SALT,
      });

      setDeployStatus(status?.deployed);
      setAccountClassHash(status?.classHash);
    };

    getAccount();
    getDeploymentStatus();
  }, [tokenContract]);



  return (
    <div className="">
      <section className="App-header py-10">

        <h1 className="my-2 text-gray-300">Testing Tokenbound SDK</h1>

        <div>
          {
          !address && connectors.map((connector) => (
            <button
              key={connector.id}
              className="bg-blue-400 rounded-md px-2 mr-5 py-2"
              onClick={() => connect({ connector })}
            >
              Connect {connector.id}

            </button>
          ))}

          {
            account && <button
              className="bg-blue-400 rounded-md px-2 mr-5 py-2"
              onClick={ async () =>  await disconnect()}
            >
              <FormatAddress address={address} />
              Disconnect
            </button>
          }
        </div>
        <br />
        <div className="space-y-4 py-10">
          <div className=" flex gap-2">
            <p className="text-[18px]">NFT Contract:</p>
            <FormatAddress address={tokenContract} />
          </div>

          <p className="text-lg">
            Token ID: <span className="text-bold">{tokenId}</span>
          </p>
          <div className="flex items-center gap-2">
            <p className="text-lg ">Tokenbound Account: </p>
            <a className="text-[#61dafb]" href={url} target="_blank">
              {" "}
              <FormatAddress address={tbaAccount} />
            </a>
          </div>
          <p className="text-lg">
            Deployed: [Status: {deployStatus?.toString()}]
          </p>
          <div className="flex items-center gap-2">
            <p className="text-lg"> ClassHash:</p>
            <FormatAddress address={accountClassHash} />
          </div>
          <p className="text-lg">
            Locked Status: [Status: {lockStatus?.toString()}, Time until
            unlocks: {timeUntilUnlocks} secs]
          </p>
          <p className="text-lg">
            Permission Status: [Status: {permissionStatus?.toString()}]
          </p>
          <div className="flex items-center gap-2">
            <p className="text-lg">Account Owner:</p>
            <FormatAddress address={owner} />
          </div>

          <div className="flex items-center gap-2">
            <p className="text-lg">NFT Owner Contract:</p>
            <FormatAddress address={nftOwner} />
          </div>

          <div className="flex items-center gap-2">
            <p className="text-lg">NFT Owner ID:</p>
            <FormatAddress address={nftOwnerId} />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <button
            onClick={deployAccount}
            className="bg-blue-400 text-medium  rounded-lg px-2 mr-5 py-1"
          >
            Deploy
          </button>

          <button
            onClick={execute}
            className="bg-green-400 text-medium  rounded-lg px-2 mr-5 py-2"
          >
            execute txn
          </button>
          <button
            onClick={transferERC20}
            className="bg-blue-800 text-medium  rounded-lg px-2 mr-5 py-2"
          >
            send ERC20
          </button>

          <button
            onClick={transferNFT}
            className="bg-yellow-500 text-medium rounded-lg px-2 py-2"
          >
            send NFT
          </button>

          <button
            onClick={lockAccount}
            className="bg-yellow-500 text-medium rounded-lg px-2 py-2"
          >
            Lock
          </button>

          <button
            onClick={upgradeAccount}
            className="bg-orange-500 text-medium rounded-lg px-2 py-2"
          >
            Upgrade
          </button>

          <button
            onClick={setPermissions}
            className="bg-orange-500 text-medium rounded-lg px-2 py-2"
          >
            Set Permissions
          </button>
        </div>
      </section>
    </div>
  );
}

export default Home;
