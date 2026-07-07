# WHBAR Unwrapper

A minimal, self-hostable web app for unwrapping **WHBAR back to native HBAR** (1:1) on the Hedera network, using [SaucerSwap's WhbarHelper contract](https://docs.saucerswap.finance/v/developer/whbar/unwrap-whbar-for-hbar).

Connect a Hedera wallet, enter an amount, approve two transactions, done — the HBAR arrives directly in your wallet. No fees beyond standard Hedera network costs. Your keys never leave your wallet.

## How it works

Unwrapping takes two on-chain transactions, which the app walks you through:

1. **Allowance approval** — grants the WhbarHelper contract permission to spend the exact WHBAR amount you entered (never more)
2. **Contract call** — invokes `unwrapWhbar(uint256)` on the helper, which redeems your WHBAR and sends native HBAR back to your account 1:1

Wallet connectivity uses the [WalletConnect / HIP-820 standard](https://hips.hedera.com/hip/hip-820) via `@hashgraph/hedera-wallet-connect`, so HashPack, and other Hedera-native wallets are supported. Balances are read from the public Hedera mirror node.

### Contracts used

| | Mainnet | Testnet |
|---|---|---|
| WHBAR token | `0.0.1456986` | `0.0.15058` |
| WhbarHelper | `0.0.5808826` | `0.0.5286055` |

These are SaucerSwap's audited, publicly documented deployments. This project is not affiliated with SaucerSwap Labs.

## Tech stack

- Vanilla TypeScript — no framework
- [Vite](https://vitejs.dev) with `vite-plugin-node-polyfills` (required: WalletConnect uses Node built-ins in the browser)
- `@hiero-ledger/sdk` (the Hedera JavaScript SDK) for building transactions
- Plain CSS, single stylesheet

## Running it yourself

```bash
npm install
npm run dev
```

Before first use, open `index.html` and set your configuration:

```html
<script>
  window.APP_CONFIG = { PROJECT_ID: 'your-walletconnect-project-id', NETWORK: 'mainnet' };
</script>
```

- `PROJECT_ID` — free from [cloud.reown.com](https://cloud.reown.com). Project IDs are public by design and safe to commit.
- `NETWORK` — `'mainnet'` or `'testnet'`.

To build for production:

```bash
npm run build   # static site output in dist/
```

Deploy `dist/` to any static host. A `netlify.toml` is included, so connecting the repo to Netlify (or Cloudflare Pages / Vercel) with default settings just works.

## Project structure

```
index.html      page markup + user configuration
src/main.ts     wallet connection + the two-transaction unwrap flow
style.css       all styling
vite.config.ts  build config (keep nodePolyfills — WalletConnect breaks without it)
netlify.toml    build settings for Netlify
```

## Security notes

- The app is fully client-side. There is no backend, no database, and nothing custodial — transactions are built locally and signed in your own wallet.
- The allowance granted in step 1 is for the **exact amount** being unwrapped, not an unlimited approval.
- Always verify transaction details in your wallet before signing, and verify the contract IDs above against [SaucerSwap's official documentation](https://docs.saucerswap.finance/developerx/contract-deployments).

## Disclaimer & limitation of liability

THIS SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.

This application interacts with third-party smart contracts and blockchain infrastructure that the authors do not control. By using this software, you acknowledge and agree that:

- **You use it entirely at your own risk.** Blockchain transactions are irreversible. Loss of funds is possible through user error, software bugs, smart-contract vulnerabilities, wallet compromise, network failures, or third-party service outages.
- **No liability.** In no event shall the authors, contributors, or copyright holders be liable for any claim, damages, or other liability — including but not limited to loss of funds, tokens, or data — whether in an action of contract, tort, or otherwise, arising from, out of, or in connection with the software or its use.
- **Not financial advice.** Nothing in this repository constitutes financial, investment, legal, or tax advice.
- **No affiliation or endorsement.** This project is independent and is not affiliated with, endorsed by, or maintained by SaucerSwap Labs, Hedera, Hashgraph, the HBAR Foundation, WalletConnect/Reown, or any wallet provider. Contract addresses and third-party services may change without notice; verify them independently.
- **Your responsibility.** You are solely responsible for reviewing the code, verifying contract addresses, safeguarding your wallet and keys, and complying with the laws of your jurisdiction.

If you do not agree with these terms, do not use this software.

## License

MIT — see [LICENSE](LICENSE).
