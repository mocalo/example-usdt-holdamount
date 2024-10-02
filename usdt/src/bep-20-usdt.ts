import { BigInt, bigInt, log, ethereum, Address } from "@graphprotocol/graph-ts"
import { BEP20USDT } from "../generated/BEP20USDT/BEP20USDT"
import {
  Approval as ApprovalEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  Transfer as TransferEvent
} from "../generated/BEP20USDT/BEP20USDT"
import { Hold1Hour, Approval, OwnershipTransferred, Transfer, AddressType } from "../generated/schema"

export function handleApproval(event: ApprovalEvent): void {
  let entity = new Approval(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.owner = event.params.owner
  entity.spender = event.params.spender
  entity.value = event.params.value

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  let entity = new OwnershipTransferred(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.previousOwner = event.params.previousOwner
  entity.newOwner = event.params.newOwner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleTransfer(event: TransferEvent): void {
  let time = event.block.timestamp.toI32() / 3600;
  let from_type = isContractWithEntity(event.params.from)
  let to_type = isContractWithEntity(event.params.to)
  let id_to = event.address.toHexString() + "-" + event.params.to.toHexString() + "-" + to_type.toString() + "-" + time.toString()
  let id_form = event.address.toString() + "-" + event.params.from.toHexString() + "-" + from_type.toString() + "-" + time.toString()
  let entity = Hold1Hour.load(id_form)
  if (entity === null) {
    entity = new Hold1Hour(id_form)
    entity.amount = event.params.value
    entity.blockNumber = event.block.number
    entity.hash = event.transaction.hash
  } else {
    entity.amount = entity.amount.minus(event.params.value)
    if (entity.amount.lt(bigInt.fromString('0'))) {
      //如果余额小于0,就说明出现了异常数据，则需要通过链上查询的方式进行纠正
      let instance = BEP20USDT.bind(event.address)
      let balance = instance.balanceOf(event.params.from)
      entity.amount = balance
      entity.blockNumber = event.block.number
      entity.hash = event.transaction.hash
      log.info("{}:地址出现小于0的持币数据,事件value:{},区块余额:{}", [
        event.params.from.toHexString(),
        event.params.value.toString(),
        balance.toString()
      ])
    }
  }
  entity = Hold1Hour.load(id_to)
  if (entity === null) {
    entity = new Hold1Hour(id_to)
    entity.amount = event.params.value
    entity.blockNumber = event.block.number
    entity.hash = event.transaction.hash
  } else {
    //to地址时，直接追加数量
    entity.amount = entity.amount.plus(event.params.value)
    entity.blockNumber = event.block.number
    entity.hash = event.transaction.hash
  }
  //添加基础数据,每个时间段的最后区块号与hash
  entity.save()
}
function isContractWithEntity(address: Address): boolean {
  //将实体作为缓存，进行地址类型判断，并返回其类型，true为合约地址，false为EOA地址
  let entity = AddressType.load(address)
  if (entity == null) {
    //如果没有实体，则将地址类型写入实体
    entity = new AddressType(address)
    let t = ethereum.hasCode(address).inner as boolean
    entity.type = t
    entity.save()
    return t
  }
  return entity.type;
}