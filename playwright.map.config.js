import {defineConfig} from '@playwright/test'
export default defineConfig({
  testDir:'./tests/browser',testMatch:'map-features.spec.js',workers:1,
  use:{baseURL:'http://localhost:5180',channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,viewport:{width:1440,height:1000},screenshot:'only-on-failure'},
  webServer:{command:'npm run dev:frontend -- --port 5180',url:'http://localhost:5180',reuseExistingServer:false,timeout:60000},
})
