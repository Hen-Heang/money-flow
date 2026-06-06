# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: verify_ui.spec.ts >> UI verification >> T03 Sonner toaster present
- Location: verify_ui.spec.ts:34:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 8000ms exceeded.
Call log:
  - waiting for locator('[data-sonner-toast]') to be visible

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - img "Money Flow logo" [ref=e5]
      - heading "Money Flow" [level=1] [ref=e13]
      - paragraph [ref=e14]: Track your finances beautifully
    - generic [ref=e15]:
      - textbox "Email" [ref=e17]: x@x.com
      - generic [ref=e18]:
        - textbox "Password" [active] [ref=e19]: badpw
        - button [ref=e20]:
          - img [ref=e21]
        - paragraph [ref=e24]: Password must be at least 6 characters
      - button "Sign In" [ref=e25]
    - generic [ref=e28]: or
    - button "Continue with Google" [ref=e30]:
      - img [ref=e31]
      - text: Continue with Google
    - button "Don't have an account? Sign Up" [ref=e36]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e42] [cursor=pointer]:
    - img [ref=e43]
  - alert [ref=e46]
```

# Test source

```ts
  1   | import { test, expect, chromium } from '@playwright/test'
  2   | 
  3   | test.describe('UI verification', () => {
  4   |   
  5   |   // T01: Sonner toast appears on bad login (mobile)
  6   |   test('T01 Sonner error toast - mobile', async () => {
  7   |     const browser = await chromium.launch()
  8   |     const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  9   |     const page = await ctx.newPage()
  10  |     await page.goto('http://localhost:3000/login')
  11  |     await page.fill('input[type="email"]', 'bad@test.com')
  12  |     await page.fill('input[type="password"]', 'wrongpassword123')
  13  |     await page.click('button[type="submit"]')
  14  |     await page.waitForSelector('[data-sonner-toast]', { timeout: 8000 })
  15  |     await page.screenshot({ path: '/tmp/t01-sonner-mobile.png' })
  16  |     const toast = await page.locator('[data-sonner-toast]').first()
  17  |     const text = await toast.innerText()
  18  |     console.log('Toast text:', text)
  19  |     await browser.close()
  20  |   })
  21  | 
  22  |   // T02: No react-hot-toast remnants
  23  |   test('T02 No react-hot-toast in DOM', async () => {
  24  |     const browser = await chromium.launch()
  25  |     const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  26  |     const page = await ctx.newPage()
  27  |     await page.goto('http://localhost:3000/login')
  28  |     const hotToast = await page.locator('#_rht_toaster, [data-hot-toast]').count()
  29  |     console.log('react-hot-toast elements:', hotToast)
  30  |     await browser.close()
  31  |   })
  32  | 
  33  |   // T03: Sonner toaster in DOM
  34  |   test('T03 Sonner toaster present', async () => {
  35  |     const browser = await chromium.launch()
  36  |     const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  37  |     const page = await ctx.newPage()
  38  |     await page.goto('http://localhost:3000/login')
  39  |     // trigger a toast to ensure toaster mounts
  40  |     await page.fill('input[type="email"]', 'x@x.com');
  41  |     await page.fill('input[type="password"]', 'badpw');
  42  |     await page.click('button[type="submit"]');
> 43  |     await page.waitForSelector('[data-sonner-toast]', { timeout: 8000 });
      |                ^ TimeoutError: page.waitForSelector: Timeout 8000ms exceeded.
  44  |     // toaster should now be present
  45  |     const toaster = await page.locator('[data-sonner-toaster]');
  46  |     const count = await toaster.count();
  47  |     const theme = count > 0 ? await toaster.getAttribute('data-theme') : 'NOT FOUND';
  48  |     console.log('Sonner theme:', theme, '| toaster count:', count)
  49  |     await browser.close()
  50  |   })
  51  | 
  52  |   // T04: Login page renders correctly
  53  |   test('T04 Login page renders', async () => {
  54  |     const browser = await chromium.launch()
  55  |     const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  56  |     const page = await ctx.newPage()
  57  |     await page.goto('http://localhost:3000/login')
  58  |     await page.screenshot({ path: '/tmp/t04-login-mobile.png' })
  59  |     await browser.close()
  60  |   })
  61  | 
  62  |   // T05: Sonner close button present
  63  |   test('T05 Sonner close button on error toast', async () => {
  64  |     const browser = await chromium.launch()
  65  |     const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  66  |     const page = await ctx.newPage()
  67  |     await page.goto('http://localhost:3000/login')
  68  |     await page.fill('input[type="email"]', 'bad@test.com')
  69  |     await page.fill('input[type="password"]', 'wrongpassword123')
  70  |     await page.click('button[type="submit"]')
  71  |     await page.waitForSelector('[data-sonner-toast]', { timeout: 8000 })
  72  |     const closeBtn = await page.locator('[data-sonner-toast] button').count()
  73  |     console.log('Close button count:', closeBtn)
  74  |     await browser.close()
  75  |   })
  76  | 
  77  |   // T06: Sign-up page renders (checks Sonner is not breaking other routes)
  78  |   test('T06 Sign-up page renders without errors', async () => {
  79  |     const browser = await chromium.launch()
  80  |     const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  81  |     const page = await ctx.newPage()
  82  |     const errors: string[] = []
  83  |     page.on('pageerror', e => errors.push(e.message))
  84  |     await page.goto('http://localhost:3000/sign-up')
  85  |     await page.screenshot({ path: '/tmp/t06-signup.png' })
  86  |     console.log('JS errors:', errors)
  87  |     await browser.close()
  88  |   })
  89  | 
  90  |   // T07: Dashboard redirects to login (auth guard working)
  91  |   test('T07 Dashboard redirect works', async () => {
  92  |     const browser = await chromium.launch()
  93  |     const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  94  |     const page = await ctx.newPage()
  95  |     const res = await page.goto('http://localhost:3000/dashboard')
  96  |     await page.screenshot({ path: '/tmp/t07-dashboard-redirect.png' })
  97  |     console.log('Final URL:', page.url())
  98  |     await browser.close()
  99  |   })
  100 | 
  101 |   // T08: Check AnimatedNumber component exists in build
  102 |   test('T08 AnimatedNumber component file exists', async () => {
  103 |     const fs = require('fs')
  104 |     const exists = fs.existsSync('/Users/mac/Documents/Front-end/money-flow/components/ui/AnimatedNumber.tsx')
  105 |     console.log('AnimatedNumber.tsx exists:', exists)
  106 |   })
  107 | 
  108 |   // T09: Check Select component exists in build
  109 |   test('T09 Select component file exists', async () => {
  110 |     const fs = require('fs')
  111 |     const exists = fs.existsSync('/Users/mac/Documents/Front-end/money-flow/components/ui/Select.tsx')
  112 |     console.log('Select.tsx exists:', exists)
  113 |   })
  114 | 
  115 |   // T10: Check BottomSheet component is Vaul-based
  116 |   test('T10 BottomSheet uses Vaul', async () => {
  117 |     const fs = require('fs')
  118 |     const content = fs.readFileSync('/Users/mac/Documents/Front-end/money-flow/components/ui/BottomSheet.tsx', 'utf8')
  119 |     const hasVaul = content.includes('vaul')
  120 |     const hasDrawer = content.includes('Drawer.Root')
  121 |     console.log('Uses vaul:', hasVaul, '| Has Drawer.Root:', hasDrawer)
  122 |   })
  123 | 
  124 |   // T11: Sonner desktop toast (1280px viewport)
  125 |   test('T11 Sonner toast - desktop', async () => {
  126 |     const browser = await chromium.launch()
  127 |     const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  128 |     const page = await ctx.newPage()
  129 |     await page.goto('http://localhost:3000/login')
  130 |     await page.fill('input[type="email"]', 'nobody@test.com')
  131 |     await page.fill('input[type="password"]', 'badpassword')
  132 |     await page.click('button[type="submit"]')
  133 |     await page.waitForSelector('[data-sonner-toast]', { timeout: 8000 })
  134 |     await page.screenshot({ path: '/tmp/t11-sonner-desktop.png' })
  135 |     const toast = await page.locator('[data-sonner-toast]').first().innerText()
  136 |     console.log('Desktop toast text:', toast)
  137 |     await browser.close()
  138 |   })
  139 | 
  140 | })
  141 | 
```