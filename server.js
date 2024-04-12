// src/server.js
import http from 'http';
import { connectToProviders, getInitialBalances, subscribeToBalanceChanges } from './services/polkadotService.js';
import { checkCardanoWallets } from './services/cardanoService.js';
import { WALLET_ADDRESSES, WSS_URLS, PORT } from './config/config.js';

function logInitialBalances(balances, addresses, urls) {
  balances.forEach((balances, walletIndex) => {
    balances.forEach((balance, providerIndex) => {
      console.log(`Initial balance for wallet ${addresses[walletIndex]} on provider ${urls[providerIndex]}: ${balance}`);
    });
  });
}

async function main() {
  const apis = await connectToProviders(WSS_URLS);
  const previousBalances = await getInitialBalances(apis, WALLET_ADDRESSES);
  logInitialBalances(previousBalances, WALLET_ADDRESSES, WSS_URLS);
  const subscriptions = subscribeToBalanceChanges(apis, WALLET_ADDRESSES, previousBalances, WSS_URLS);

  // Check Cardano wallets
  await checkCardanoWallets();

  // Create an HTTP server and bind it to the specified port
  const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Server is running');
  });

  server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
  });
}

main().catch(console.error);