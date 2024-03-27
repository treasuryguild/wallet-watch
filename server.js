const { ApiPromise, WsProvider } = require('@polkadot/api');
const fetch = require('node-fetch');

// Replace with your desired Polkadot node URL
const WSS_URL = 'wss://rpc.polkadot.io';

// Replace with the address of the wallet you want to watch
const WALLET_ADDRESS = '5GGxt4D7rGu89zTMCp5rxvzuaq8F1eVPobwxpeADEiPDoQxZ';

// Replace with the URL of your Next.js Netlify function
const NETLIFY_FUNCTION_URL = 'https://your-netlify-site.netlify.app/api/handle-balance-change';

async function main() {
  const provider = new WsProvider(WSS_URL);
  const api = await ApiPromise.create({ provider });

  const previousBalance = await api.query.system.account(WALLET_ADDRESS);

  console.log(`Initial balance: ${previousBalance.data.free.toHuman()}`);

  // Subscribe to balance changes
  const unsubscribe = await api.query.system.account(WALLET_ADDRESS, (balance) => {
    if (balance.data.free.toHuman() !== previousBalance.data.free.toHuman()) {
      console.log(`Balance changed: ${balance.data.free.toHuman()}`);

      // Send balance change to your Next.js Netlify function
      /*fetch(NETLIFY_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: WALLET_ADDRESS,
          newBalance: balance.data.free.toHuman(),
        }),
      })
        .then((response) => {
          console.log('Balance change sent to Netlify function');
        })
        .catch((error) => {
          console.error('Error sending balance change to Netlify function:', error);
        });*/
    }
  });
}

main().catch(console.error);