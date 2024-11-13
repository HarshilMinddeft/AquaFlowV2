import * as algokit from '@algorandfoundation/algokit-utils'
import algosdk from 'algosdk'
import { AquaFlowV2Client } from './contracts/AquaFlowV2'

const validateAppId = async (appId: number) => {
  try {
    // Fetch the application information from Algorand network
    const appInfo = await algosdk.getApplicationAddress(appId)

    // If the app exists, return true
    return appInfo ? true : false
  } catch (error) {
    console.error('Invalid App ID:', error)
    return false
  }
}

export function create(
  algorand: algokit.AlgorandClient,
  AquaFlowAbiClient: AquaFlowV2Client,
  sender: string,
  setAppId: (id: number) => void,
) {
  return async () => {
    const createResult = await AquaFlowAbiClient.create.bare()
    setAppId(Number(createResult.appId))
    console.log(createResult.appId)
    console.log(sender)
    console.log(createResult.appAddress)
  }
}

// Method.ts code for methods calls info

// Helper to get contract's address from app ID
const getApplicationAddress = (appId: number): string => {
  return algosdk.getApplicationAddress(appId)
}

function convertToMicroAlgos(algos: bigint | number): bigint {
  return BigInt(algos) // Return the input value directly
}

async function fetchStreamData(algorand: algokit.AlgorandClient, appId: number, streamId: bigint) {
  try {
    // Convert stream ID to bytes (if required by Algorand)
    const boxKey = new Uint8Array(new TextEncoder().encode(streamId.toString()))

    // Fetch the box value directly using Algorand SDK's `algod` client
    const boxValueResponse = await algorand.client.algod.getApplicationBoxByName(appId, boxKey).do()

    // Decode the box data if needed (depends on how data is stored in the box)
    const decodedData = new TextDecoder().decode(boxValueResponse.value)

    console.log('Fetched Stream Data:', decodedData)
    return decodedData
  } catch (error) {
    console.error('Error fetching box data:', error)
    throw error
  }
}

export function startStream(
  algorand: algokit.AlgorandClient,
  AquaFlowAbiClient: AquaFlowV2Client,
  sender: string,
  streamCreator: string,
  streamRate: bigint,
  recipient: string,
  amount: bigint,
  appId: number,
) {
  return async () => {
    try {
      const streamRateInMicroAlgos = convertToMicroAlgos(streamRate)
      const appAddress = getApplicationAddress(appId)
      const algoAmount = algokit.microAlgos(Number(amount))
      // console.log('after Stream Rate:', streamRate)
      // console.log('After Amount:', algoAmount)

      // Start the stream
      const startStreamResult = await AquaFlowAbiClient.startStream(
        {
          streamCreator,
          recipient,
          rate: streamRateInMicroAlgos,
          amount: amount,
        },
        { sendParams: { populateAppCallResources: true } },
      )

      // Create payment transaction
      const newStreamId = startStreamResult.return
      console.log('newStreamId', newStreamId)

      const paymentTxn = await algorand.send.payment({
        sender, // Sender's address (wallet)
        receiver: appAddress, // The smart contract's app address
        amount: algoAmount, // Amount to transfer to the contract
      })
      // console.log('Payment transaction ID:', paymentTxn.txIds)
      // console.log('Payment transaction sent:', paymentTxn.returns)
      return newStreamId as any
    } catch (error) {
      console.error('Failed to start stream:', error)
    }
  }
}

export function startStreamWithExistId(
  algorand: algokit.AlgorandClient,
  AquaFlowAbiClient: AquaFlowV2Client,
  sender: string,
  streamCreator: string,
  streamRate: bigint,
  recipient: string,
  amount: bigint,
  appId: number,
  streamId: number,
) {
  return async () => {
    try {
      const streamRateInMicroAlgos = convertToMicroAlgos(streamRate)
      const appAddress = getApplicationAddress(appId)
      const algoAmount = algokit.microAlgos(Number(amount))
      const startExistIdStream = await AquaFlowAbiClient.startWithExistingId(
        { streamId, streamCreator, recipient, rate: streamRateInMicroAlgos, amount },
        { sendParams: { populateAppCallResources: true } },
      )

      const paymentTxn = await algorand.send.payment({
        sender, // Sender's address (wallet)
        receiver: appAddress, // The smart contract's app address
        amount: algoAmount, // Amount to transfer to the contract
      })
    } catch (error) {
      console.error('Failed to start stream:', error)
    }
  }
}

export function withdraw(
  algorand: algokit.AlgorandClient,
  AquaFlowAbiClient: AquaFlowV2Client,
  sender: string,
  appId: number,
  streamId: bigint,
) {
  return async () => {
    try {
      const appAddress = getApplicationAddress(appId)
      console.log('App ID:', appAddress)

      // Prompt user for a fee
      const userFee = parseFloat('0.002')

      // Validate user fee input
      if (isNaN(userFee) || userFee <= 0) {
        console.error('Invalid fee provided. Please enter a positive number.')
        return
      }

      // Perform the withdraw operation with the appropriate send parameters
      const withdrawResult = await AquaFlowAbiClient.withdraw(
        { streamId },
        {
          sendParams: {
            fee: algokit.algos(userFee),
            populateAppCallResources: true,
          },
        },
      )

      // Check for confirmation
      if (withdrawResult.confirmation) {
        return { success: true }
      } else {
        throw new Error('Withdrawal failed: No confirmation received.')
      }
    } catch (error) {
      console.error('Error during withdrawal:', error)
      throw error
    }
  }
}

export function stopStream(
  algorand: algokit.AlgorandClient,
  AquaFlowAbiClient: AquaFlowV2Client,
  sender: string,
  appId: number,
  recipient: string,
  streamId: bigint,
) {
  return async () => {
    try {
      const internalTransactions: Array<{ amount: number; receiver: string }> = []
      const appAddress = getApplicationAddress(appId)
      const stopStreamM = await AquaFlowAbiClient.stopStream(
        { streamId },
        { sendParams: { fee: algokit.algos(0.004), populateAppCallResources: true } },
      )

      // Check if there are inner transactions
      if (stopStreamM.confirmations && stopStreamM.confirmations.length > 0) {
        const confirmation = stopStreamM.confirmations[0]

        // Check if inner transactions exist
        if (confirmation.innerTxns && confirmation.innerTxns.length > 0) {
          console.log(`Found ${confirmation.innerTxns.length} internal transactions:`)

          // Loop through each internal transaction and log its details
          confirmation.innerTxns.forEach((innerTxn, index) => {
            console.log(`Internal Transaction ${index + 1}:`)
            const txnDetails = innerTxn.txn
            const amount = Number(txnDetails.txn.amt) / 1000000
            const receiver = algosdk.encodeAddress(txnDetails.txn.rcv as any)

            internalTransactions.push({
              amount,
              receiver,
            })

            console.log('Amount:', Number(txnDetails.txn.amt) / 1000000)
            console.log('Sender:', algosdk.encodeAddress(txnDetails.txn.snd))
            // console.log('ReceiverEncodeLease:', algokit.encodeLease(txnDetails.txn.rcv))
            console.log('First valid round:', txnDetails.txn.fv)
            console.log('Last valid round:', txnDetails.txn.lv)
          })
        } else {
          console.log('No internal transactions found.')
        }
      } else {
        console.log('No confirmations found.')
      }
      return internalTransactions
    } catch (error) {
      throw error
    }
  }
}

// export function getCurrentWithdawamount(
//   algorand: algokit.AlgorandClient,
//   AquaFlowAbiClient: AquaFlowV2Client,
//   sender: string,
//   appId: number,
// ) {
//   return async () => {
//     const withdrawAmount = await AquaFlowAbiClient.getWithdrawAmount({})
//     console.log('CurrentWithdrawAmount', withdrawAmount.return?.toString())
//     return Number(withdrawAmount.return?.toString() || 0)
//   }
// }

export function deleteStream(
  algorand: algokit.AlgorandClient,
  AquaFlowAbiClient: AquaFlowV2Client,
  sender: string,
  appId: number,
  streamId: bigint,
) {
  return async () => {
    try {
      const internalTransactions: Array<{ amount: number; receiver: string }> = []
      const deleteAapp = await AquaFlowAbiClient.deleteStream(
        { streamId },
        { sendParams: { fee: algokit.algos(0.003), populateAppCallResources: true } },
      )
      console.log('DeleteappConformations', deleteAapp.confirmations)
      // Check if there are inner transactions
      if (deleteAapp.confirmations && deleteAapp.confirmations.length > 0) {
        const confirmation = deleteAapp.confirmations[0]

        // Check if inner transactions exist
        if (confirmation.innerTxns && confirmation.innerTxns.length > 0) {
          console.log(`Found ${confirmation.innerTxns.length} internal transactions:`)

          // Loop through each internal transaction and log its details
          confirmation.innerTxns.forEach((innerTxn, index) => {
            console.log(`Internal Transaction ${index + 1}:`)
            const txnDetails = innerTxn.txn
            const amount = Number(txnDetails.txn.amt) / 1000000
            const receiver = algosdk.encodeAddress(txnDetails.txn.rcv as any)

            internalTransactions.push({
              amount,
              receiver,
            })

            console.log('Amount:', Number(txnDetails.txn.amt) / 1000000)
            console.log('Sender:', algosdk.encodeAddress(txnDetails.txn.snd))
            // console.log('ReceiverEncodeLease:', algokit.encodeLease(txnDetails.txn.rcv))
            console.log('First valid round:', txnDetails.txn.fv)
            console.log('Last valid round:', txnDetails.txn.lv)
          })
        } else {
          console.log('No internal transactions found.')
        }
      } else {
        console.log('No confirmations found.')
      }
      return internalTransactions
      // return deleteAapp.confirmations
    } catch (error) {
      throw error
    }
  }
}

export function streamEndTime(
  algorand: algokit.AlgorandClient,
  AquaFlowAbiClient: AquaFlowV2Client,
  sender: string,
  appId: number,
  streamId: number,
) {
  return async () => {
    const appAddress = getApplicationAddress(appId)
    const streamendTime = await AquaFlowAbiClient.getStreamEndTime({ streamId })
    console.log('steam End time=>', streamendTime.return?.toString())
  }
}
