// src/utils/netlifyUtils.js
import fetch from 'node-fetch';
import { NETLIFY_FUNCTION_URL } from '../config/config.js';

export async function sendTransactionDetailsToNetlify(transactionDetails) {
  try {
    const response = await fetch(NETLIFY_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transactionDetails),
    });

    if (response.ok) {
      console.log('Transaction details sent to Netlify function');
    } else {
      console.error('Error sending transaction details to Netlify function:', response.status);
    }
  } catch (error) {
    console.error('Error sending transaction details to Netlify function:', error);
  }
}