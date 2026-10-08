# React + TypeScript + Vite

## Running the dashboard with live alerts

Install dependencies once with `npm install` in both `api/` and `dashboard/`.
Then start the API and dashboard in separate terminals:

```sh
cd api
npm start
```

```sh
cd dashboard
npm run dev
```

The Vite development proxy forwards `/api` requests and `/ws` WebSocket
connections to the API at `http://127.0.0.1:3000`. The dashboard requests alerts from the last 12 hours using ISO 8601 UTC
`since`/`to` parameters based on measurement timestamps, then listens for new
`alert.created` events. If the WebSocket reconnects, it requests a fresh
12-hour range to catch up.

The dashboard preserves measurement keys and keeps each key in a separate
series. It displays French labels for known keys such as `temperature_c`,
`humidity_pct`, `gas_raw`, and `motion`; the underlying API data is unchanged.

The Vite proxy only applies during development. In production, configure the
web server or reverse proxy to forward `/api` and `/ws` to the API, including
WebSocket upgrades.

## Command controls

Copy `.env.example` to `.env` and set the monitored equipment IDs for each
action. `VITE_BUZZER_DEVICE_ID`, `VITE_LEDS_TEST_DEVICE_ID`, and
`VITE_LEDS_AUTO_DEVICE_ID` are sent as `device_id` in the corresponding API
request. These identify the monitored equipment, not the ESP8266 MQTT gateway.
The LEDs test and automatic-mode actions may use the same equipment ID.

The frontend contains no MQTT credentials and never connects to the broker
directly. Vite environment values are embedded in the built frontend, so these
IDs must not contain secrets.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

````

## UI components

The dashboard uses [shadcn/ui](https://ui.shadcn.com/). Its components are
maintained in `src/components/ui` and can be customized directly. From this
directory, add further components with:

```sh
npx shadcn add <component>
```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

````

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs["recommended-typescript"],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```
