import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir:'./tests/browser',testMatch:'app.spec.js',fullyParallel:false,workers:1,
  use:{baseURL:'http://localhost:5173',channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome',headless:true,viewport:{width:1440,height:1100},screenshot:'only-on-failure'},
  webServer:{command:'npm run dev',url:'http://localhost:5173',reuseExistingServer:true,timeout:120000},
})
