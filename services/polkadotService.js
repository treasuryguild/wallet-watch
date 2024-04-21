// src/services/polkadotService.js
import { ApiPromise, WsProvider } from '@polkadot/api';
import { sendTransactionDetailsToNetlify } from '../utils/netlifyUtils.js';

export async function connectToProviders(urls) {
  const providers = urls.map(url => new WsProvider(url));
  return Promise.all(providers.map(provider => ApiPromise.create({ provider })));
}

export async function getInitialBalances(apis, addresses) {
  return Promise.all(
    addresses.map(async (address) => {
      const balances = await Promise.all(apis.map(api => api.query.system.account(address)));
      return balances.map(balance => balance.data.free.toHuman());
    })
  );
}

export function subscribeToBalanceChanges(apis, addresses, previousBalances, wsUrls) {
    return addresses.map((address, walletIndex) =>
      apis.map((api, providerIndex) =>
        api.query.system.account(address, async (balance) => {
          const newBalance = balance.data.free.toHuman();
          const previousBalance = previousBalances[walletIndex][providerIndex];
  
          if (newBalance !== previousBalance) {
            const providerUrl = wsUrls[providerIndex] || 'Unknown Provider';
            console.log(`Balance changed for wallet ${address} on provider ${providerUrl}: ${newBalance}`);
  
            // Compare the new balance with the previous balance
            if (newBalance > previousBalance) {
              console.log(`Balance increased for wallet ${address} from ${previousBalance} to ${newBalance}`);
  
              // Get the last block hash
              const lastBlockHash = await api.rpc.chain.getBlockHash();
  
              // Get the block header
              const blockHeader = await api.derive.chain.getHeader(lastBlockHash);
  
              // Get the transaction details
              const signedBlock = await api.rpc.chain.getBlock(lastBlockHash);
              const allRecords = await api.query.system.events.at(signedBlock.block.header.hash);
  
              // Find the relevant transaction record
              const transactionRecord = allRecords.find(({ event }) =>
                event.section === 'balances' &&
                event.method === 'Transfer' &&
                event.data[1].toString() === address
              );
  
              if (transactionRecord) {
                const fromAddress = transactionRecord.event.data[0].toString();
                let aggregatedAmount = BigInt(0);
              
                // Iterate through all records and find transfer events where the address is the recipient
                allRecords.forEach(({ event }) => {
                  if (
                    event.section === 'balances' &&
                    event.method === 'Transfer' &&
                    event.data[1].toString() === address
                  ) {
                    const amount = BigInt(event.data[2].toString());
                    aggregatedAmount += amount;
                  }
                });
              
                // Find the corresponding extrinsic for the event
                const transactionEvent = allRecords.find(
                  ({ event }) =>
                    event.section === 'balances' &&
                    event.method === 'Transfer' &&
                    event.data[0].toString() === fromAddress &&
                    event.data[1].toString() === address
                );
              
                if (transactionEvent) {
                  const transactionIndex = transactionEvent.phase.asApplyExtrinsic.toNumber();
                  const transactionExtrinsic = signedBlock.block.extrinsics[transactionIndex];
              
                  if (transactionExtrinsic) {
                    const transactionHash = transactionExtrinsic.hash.toString();
              
                    // Create the JSON object
                    const transactionDetails = {
                      walletAddress: address,
                      fromAddress,
                      amount: aggregatedAmount.toString(),
                      transactionHash,
                      blockNumber: blockHeader.number.toNumber(),
                      blockHash: blockHeader.hash.toString(),
                      timestamp: blockHeader.timestamp ? new Date(blockHeader.timestamp.toNumber()).toISOString() : new Date().toISOString(),
                    };
              
                    console.log('Transaction details:', transactionDetails);
              
                    // Send transaction details to Netlify function
                    //await sendTransactionDetailsToNetlify(transactionDetails);
                  } else {
                    console.log('Transaction extrinsic not found for the balance change event.');
                  }
                } else {
                  console.log('Transaction event not found for the balance change event.');
                }
              }
            }
  
            // Update the previous balance with the new balance
            previousBalances[walletIndex][providerIndex] = newBalance;
          }
        })
      )
    );
  }