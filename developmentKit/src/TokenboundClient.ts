import { 
    AccountInterface,
    Contract, 
    BigNumberish, 
    CallData, 
    TypedData,
    cairo 
} from "starknet"

import { 
    Call, 
    CreateAccountOptions, 
    GetAccountOptions, 
    TokenboundClientOptions, 
    GetOwnerOptions, 
    ERC20TransferOptions, 
    NFTTransferOptions, 
    MultiCall 
} from "./types/TokenboundClient"

import { accountClient } from "./utils/account"
import { getProvider } from "./utils/provider"

import registryAbi from "./abis/registry.abi.json"
import accountAbi from "./abis/account.abi.json"

export class TokenboundClient {
    private account: AccountInterface
    private jsonRPC: string
    private registryAddress: string
    private implementationAddress: string
    public isInitialized: boolean = false

    constructor(options: TokenboundClientOptions) {
        const { walletClient, account, jsonRPC, registryAddress, implementationAddress} = options
        
        if(account && walletClient) {
            throw new Error('only one of `account` or `walletClient` is required!')
        }

        account ? this.account = account : this.account = accountClient(jsonRPC, walletClient)
        this.jsonRPC = jsonRPC
        this.registryAddress = registryAddress
        this.implementationAddress = implementationAddress
    }

    public async getAccount(params: GetAccountOptions) {
        const { tokenContract, tokenId, salt, chain_id } = params
        const provider = getProvider(this.jsonRPC)
        const contract = new Contract(registryAbi, this.registryAddress, provider)

        try{
            const address: BigNumberish = await contract.get_account(
                this.implementationAddress,
                tokenContract,
                tokenId,
                salt ? salt : tokenId,
                chain_id
            )
            return address
        }
        catch (error) {
            throw error
        }
    }

    public async createAccount(params: CreateAccountOptions) {
        const { tokenContract, tokenId, salt, chain_id } = params
        
        const contract = new Contract(registryAbi, this.registryAddress, this.account)

        let salt_arg = salt ? salt : tokenId
        try {
            await contract.create_account(
                this.implementationAddress,
                tokenContract,
                tokenId,
                salt_arg,
                chain_id
            )

            return await this.getAccount({
                tokenContract,
                tokenId,
                salt: salt_arg,
                chain_id
            })
        }
        catch (error) {
            throw error
        }
    }

    public async checkAccountDeployment(params: GetAccountOptions) {
        const { tokenContract, tokenId, salt, chain_id } = params
        const provider = getProvider(this.jsonRPC)

        let salt_arg = salt ? salt : tokenId
        let address = await this.getAccount({
            tokenContract,
            tokenId,
            salt: salt_arg,
            chain_id
        })

        try {
            const classHash = await provider.getClassHashAt(address)
            if(classHash) {
                return { deployed: true, classHash }
            }
        }
        catch (error) {
            return { deployed: false, classHash: ''}
        }
    }

    public async execute(tbaAddress: string, calls: Call[]) {
        const provider = getProvider(this.jsonRPC)

        let call: MultiCall = {
            contractAddress: tbaAddress,
            entrypoint: 'execute',
            calldata: CallData.compile({
                calls
            })
        }

        try {
            const result = await this.account.execute(call)
            await provider.waitForTransaction(result.transaction_hash)
            return true
        }
        catch (error) {
            throw error
        }
    }


    public async getOwner(options: GetOwnerOptions) {
        let { tbaAddress, tokenContract, tokenId } = options
        const contract = new Contract(accountAbi, tbaAddress, this.account)

        try {
            let owner = await contract.owner(tokenContract, tokenId)
            return owner
        }
        catch (error) {
            throw error
        }
    }
    
    
    public async getOwnerNFT(tbaAddress: string) {
        const contract = new Contract(accountAbi, tbaAddress, this.account)

        try {
            let ownerNFT = await contract.token()
            return ownerNFT
        }
        catch (error) {
            throw error
        }
    }

    public async transferERC20(options: ERC20TransferOptions) {

        const { tbaAddress, contractAddress, recipient, amount} = options    
                
        let call: Call = {
            to: contractAddress,
            selector: "0x83afd3f4caedc6eebf44246fe54e38c95e3179a5ec9ea81740eca5b482d12e",
            calldata: CallData.compile({
                recipient, 
                amount: cairo.uint256(amount)
            })
        }

        try {
            return await this.execute(tbaAddress, [call])
        }
        catch (error) {
            throw error
        }
    }




    public async transferNFT(options: NFTTransferOptions) {
        const { tbaAddress, contractAddress, tokenId, sender, recipient} = options

        let call: Call = {
            to: contractAddress,
            selector: "0x41b033f4a31df8067c24d1e9b550a2ce75fd4a29e1147af9752174f0e6cb20",
            calldata: CallData.compile({
                from_: sender, 
                to: recipient, 
                amount: cairo.uint256(tokenId)
            })
        }

        try {
            return await this.execute(tbaAddress, [call])
        }
        catch (error) {
            throw error
        }
    }

    public async signMessage(typedData: TypedData) {
        try {
            return await this.account.signMessage(typedData)
        }
        catch (error) {
            throw error
        }
    }
}
