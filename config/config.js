// src/config/config.js
export const WALLET_ADDRESSES = [
    '5GGxt4D7rGu89zTMCp5rxvzuaq8F1eVPobwxpeADEiPDoQxZ',
    '5FmuQEdBC6BZcLWAngpo2owTFyeAWe9xR7LHZwd6kNE8WV5T',
    // Add more wallet addresses as needed
  ];
  
  export const WSS_URLS = [
    'wss://ws.test.azero.dev',
    'wss://rpc.polkadot.io',
    // Add more WebSocket URLs as needed
  ];
  
  export const SUBSCAN_URLS = [
    'https://alephzero-testnet.api.subscan.io',
    'https://polkadot.api.subscan.io', 
    // Add more WebSocket URLs as needed
  ];

  export const NETLIFY_FUNCTION_URL = 'https://your-netlify-site.netlify.app/api/handle-balance-change';
  export const PORT = process.env.PORT || 4000;