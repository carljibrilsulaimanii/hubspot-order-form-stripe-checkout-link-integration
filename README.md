<!--
  README.md -- HubSpot order form + Stripe checkout link integration
  Author:  Jibril Sulaiman
  Created: 2026-09-28 (from a production build first shipped 2026-09-04)
  What:    What this is for, how it works, and every setup step with a check.
  Why:     Nearly every failure in this flow is silent: Stripe drops UTM values
           it doesn't like without an error, links with the wrong setting never
           capture anything, and reports just show "no source".
-->

# HubSpot order form + Stripe checkout link integration

A **two-step order form for HubSpot pages** that hands buyers to a **Stripe
Payment Link** instead of HubSpot's own checkout, and still records which
campaign made each sale.

Step 1 is a normal HubSpot form, so every buyer becomes a contact before they pay.
Step 2 sends them straight to your Stripe Payment Link with their email prefilled
and their campaign attached. After they pay, a HubSpot workflow reads that
campaign back from Stripe and writes it onto the payment record, next to the amount.
That attribution half is its own repo,
[hubspot-stripe-utm-attribution](https://github.com/carljibrilsulaimanii/hubspot-stripe-utm-attribution); this one is the form.

## Why it exists

**HubSpot has no native order form.** A form and a payment are separate things in
HubSpot: you place a form module and a payment button on a page and hope buyers
use both. There's no step 1 "your details", step 2 "pay" flow, no order summary or
coupon field inline with the form, and nothing that moves the buyer from one to
the other.

**HubSpot's native Stripe checkout holds back much of what Stripe can do.** With
Stripe connected as HubSpot's payment processor, checkout runs on HubSpot's own
payment domain, in a sliding overlay, not on Stripe's checkout. In the portal this
was built for (Aug–Sep 2026), that meant:

| | HubSpot checkout (Stripe as processor) | Stripe Payment Link |
|---|---|---|
| Payment methods offered | Card and US bank account | Everything enabled in Stripe: Apple Pay, Google Pay, Klarna, Afterpay, Cash App, Link... |
| Apple Pay | Didn't render. The checkout is served from HubSpot's domain, which you can't register with Stripe for Apple Pay, inside a cross-origin overlay. | Works on your own checkout domain once registered with Stripe |
| Email from the form | Not carried into checkout for new visitors | `prefilled_email` on the link |
| Order bump / add-on | Needed two payment links, two payment modules and a checkbox to switch between them | Built in: an optional "Add to your order" item |
| Order summary and coupon field | Only inside the overlay, not beside the form | On Stripe's checkout page, with Stripe's promotion codes |

Capabilities change, so check your own portal. But if any of these matter to you,
the answer is to take payment on Stripe and keep HubSpot for the CRM.

**Moving checkout to Stripe breaks attribution, though.** The moment a buyer leaves
your site for Stripe:

- **The campaign is gone before checkout.** Ads land on a landing page with UTMs
  in the URL. HubSpot form redirects rebuild the URL and drop them, so the order
  page, and the Stripe link on it, never see where the buyer came from.
- **Stripe hides what it does keep.** There's no UTM field on the Checkout
  Session and none in the payment webhook. And Stripe **silently drops** any UTM
  value that isn't plain letters, digits, `-` or `_`. That's most ad-platform
  campaign names ("Brand | Fall | Prospecting").
- **HubSpot's commerce reports don't see it.** Payments taken on Stripe aren't
  HubSpot payments, so the source has to be written onto whatever record your
  Stripe payments sync into.
- **The payment and the contact drift apart** unless the buyer's email travels
  with the link.

The form is the bridge for the buyer; the attribution (the cookie that survives the
redirects, Stripe's success URL, and the workflow that puts the campaign on the
payment) is in [hubspot-stripe-utm-attribution](https://github.com/carljibrilsulaimanii/hubspot-stripe-utm-attribution).

**What you give up:** HubSpot's native payment records, commerce reporting and
payment-based workflows (like HubSpot's abandoned-cart flows). Step 1 still
creates the contact before checkout, so you can build abandoned-checkout
follow-up on "submitted the order form but no payment".

## How it works

```text
 Ad / email / SMS link  ?utm_source=fb&utm_campaign=Brand | Fall
        │
        ▼
 1. Any page on your site ─ site-header/utm-capture.html
        stores the UTMs and click ids in a first-party cookie (90 days)
        │   ...buyer browses, fills in a form, lands on the order page
        ▼
 2. Order page ─ Order Form (Stripe) module
        step 1: HubSpot form  ──submit──►  step 2: redirect to the Stripe link
        https://buy.stripe.com/abc?utm_source=fb&utm_campaign=Brand-Fall
                                   &prefilled_email=...&gclid=...&fbc=...
        │
        ▼
 3. Stripe checkout ─ Payment Link with confirmation behavior = "redirect"
        Stripe copies the five UTMs onto the redirect: the Checkout Session's success_url
        │
        ▼
 4. HubSpot workflow ─ workflow-action/stripe-utm-action.js
        finds the session for the payment, parses success_url, and writes
        stripe_utm_source / medium / campaign / content / term, the promo code,
        the session and link ids, and where the UTM came from
```

## What's in this repo

| Path | What it is | Where it goes |
|---|---|---|
| [`module/order-form-stripe.module/`](module/order-form-stripe.module/) | The two-step order form: [`module.html`](module/order-form-stripe.module/module.html) · [`module.css`](module/order-form-stripe.module/module.css) · [`module.js`](module/order-form-stripe.module/module.js) · [`fields.json`](module/order-form-stripe.module/fields.json) · [`meta.json`](module/order-form-stripe.module/meta.json) | HubSpot **Design Manager** module |
| [`test/`](test/) | The module's browser script runs unchanged against a fake page | `npm test` |

The site header script, the UTM workflow action and the link scripts moved to
[hubspot-stripe-utm-attribution](https://github.com/carljibrilsulaimanii/hubspot-stripe-utm-attribution).

Zero dependencies. Node 20+ for the tests.

---

## Table of contents

1. [Requirements](#1-requirements)
2. [Setup, step by step](#2-setup-step-by-step)
   - [Step 1: Set up UTM attribution first](#step-1-set-up-utm-attribution-first)
   - [Step 2: Build the Order Form (Stripe) module](#step-2-build-the-order-form-stripe-module)
   - [Step 3: Put the module on your order page](#step-3-put-the-module-on-your-order-page)
   - [Step 4: Test the form](#step-4-test-the-form)
3. [Test mode](#3-test-mode)
4. [Troubleshooting](#4-troubleshooting)
5. [Security and privacy](#5-security-and-privacy)

---

## 1. Requirements

| You need | Why |
|---|---|
| A HubSpot form for step 1 | Every buyer becomes a contact before they pay |
| Stripe **Payment Links** set to redirect after payment | The form hands buyers to them ([UTM repo Step 1](https://github.com/carljibrilsulaimanii/hubspot-stripe-utm-attribution#step-1-set-every-stripe-payment-link-to-redirect)) |
| The UTM attribution repo's header script and workflow | Step 1 |
| Design Manager access | Step 2 |

---

## 2. Setup, step by step

Do the steps in order. Each one ends with a ✅ **Check**.

### Step 1: Set up UTM attribution first

*About 1 hour, in the other repo.*

The form hands buyers to Stripe with their campaign attached, but the campaign comes
from a cookie, and the sale's source is written back by a workflow. Both live in
[hubspot-stripe-utm-attribution](https://github.com/carljibrilsulaimanii/hubspot-stripe-utm-attribution). Do its Steps 1 to 5 first:

| UTM repo step | Why the order form needs it |
|---|---|
| 1. Set every Payment Link to redirect | The link you paste into the module must redirect, or its UTMs go nowhere |
| 2. Audit your links | Catches links with hard-coded UTMs before you use them here |
| 3. Site header script | Stores the campaign in the `site_attr` cookie this module reads |
| 4–5. Properties and the UTM workflow | Writes the campaign onto the payment after checkout |

> ⚠️ **Cookie name.** The module reads `COOKIE_NAME = 'site_attr'`, the header script's
> default. If you change one, change the other.

✅ **Check:** on any page of your site, after visiting a tagged URL, `document.cookie`
contains `site_attr`.

---

### Step 2: Build the Order Form (Stripe) module

*About 20 minutes by hand, 5 with the CLI.*

Before either path: open [`module/order-form-stripe.module/module.js`](module/order-form-stripe.module/module.js) and check
that `var COOKIE_NAME = 'site_attr';` matches the `COOKIE` name in the header
script ([UTM repo Step 3a](https://github.com/carljibrilsulaimanii/hubspot-stripe-utm-attribution#step-3-install-the-site-header-script-on-every-domain)).

#### 4A. By hand in Design Manager

**2a. Create the module file.**
1. In HubSpot, go to **Content** > **Design Manager**.
2. Click **File** > **New file**, and choose **Module**. The panel titled **Set up
   your new module** opens.
3. *"Where would you like to use this module?"*: tick **Landing pages** and **Site
   pages**. Leave the rest unticked.
4. **Module content scope:** leave **Local module** selected.
5. **File name:** `Order Form (Stripe)`.
6. **File location:** leave it, or click **Change** to put it in your own folder.
7. Click **Create**.

> ⚠️ **Tick both page types.** In the original build a module scoped to **Site
> pages** only didn't appear in the landing page editor at all, and time was lost
> hunting for a template problem. You can fix this later in the right sidebar
> under **Content types**.

**2b. Name it.** In the right sidebar, set **Label** to `Order Form (Stripe)`.
This is the name editors see when they add a module to a page. Under it,
**Content types** should read *Landing pages, Site pages*.

**2c. Paste the code.** The editor has three panes, top to bottom. In each one,
select everything and delete the sample code, then paste in the **whole** file:

| Pane | Paste all of |
|---|---|
| **module.html (HTML + HubL)** | [`module/order-form-stripe.module/module.html`](module/order-form-stripe.module/module.html) |
| **module.css** | [`module/order-form-stripe.module/module.css`](module/order-form-stripe.module/module.css) |
| **module.js** | [`module/order-form-stripe.module/module.js`](module/order-form-stripe.module/module.js) |

The status bar at the bottom left should read **No errors found**.

**2d. Add the nine fields.** In the right sidebar, under **Fields**, click **Add
field** and pick the type. When the field opens:
1. Type the **Label**.
2. Check the **HubL variable name** under it. HubSpot builds one from the label,
   and it's usually wrong for this module. Correct it to the exact value in the
   table.
3. Set the default and help text from the table.
4. Click the **✕** next to the field's name at the top of the panel to go back to
   the Fields list, then add the next one.

| # | Field type | Label | HubL variable name | Default | Help text (optional) |
|---|---|---|---|---|---|
| 1 | **Form** | `Form (step 1)` | `step_form` | Your step-1 form, if it exists yet. Keep *"Supported form versions"* on **Forms and legacy forms**. Mark it required. | The HubSpot form buyers fill in before paying. Its email field is passed to Stripe as prefilled_email. |
| 2 | **Text** | `Step 1 tab label` | `tab_1_label` | `YOUR INFO` | |
| 3 | **Text** | `Step 2 tab label` | `tab_2_label` | `CHECKOUT` | |
| 4 | **Text** | `Stripe Link` | `stripe_link` | *(empty)* | The live Stripe Payment Link. Its confirmation behavior must be 'redirect' or no UTMs are captured. |
| 5 | **Text** | `Submit button label` | `button_label` | `Continue to Payment` | Replaces the form's own submit text. |
| 6 | **Boolean** | `Prefill email on Stripe` | `prefill_email` | **On** | Adds prefilled_email so the payment matches the HubSpot contact. |
| 7 | **Boolean** | `Open checkout in a new tab` | `open_new_tab` | **Off** | Usually leave off. |
| 8 | **Boolean** | `Test mode` | `test_mode` | **Off** | Uses Test Stripe Link and shows a TEST MODE banner to everyone. |
| 9 | **Text** | `Test Stripe Link` | `test_stripe_link` | *(empty)* | Stripe test-mode payment link. Only used when Test mode is on. |

For the three Boolean fields, set the display to a toggle if HubSpot offers the
choice *(wording may differ)*. It only changes how the switch looks in the page
editor.

The Fields list shows each one as *Label (Type)* over the variable name, e.g.
*Stripe Link (Text)* / `stripe_link`. Compare every variable name against the
table before you publish.

> ⚠️ **The variable name is what the code reads. The label is only for people.**
> In the original build the field was labelled *Stripe Link* with the variable
> `stripe_link`, while the first draft of `module.html` read `module.stripe_url`.
> The page rendered fine and checkout silently had no link. Don't rename a
> variable once pages use the module, either: HubSpot stores each page's value
> under the variable name, so a rename blanks the field on every page.

> ⚠️ **If you cloned an existing module instead of creating a new file,** delete
> the fields it brought along (the original build inherited a leftover CRM object
> field) and change the **Label**, which still carries the old module's name.

**2e. Add the editor reminder.** In the right sidebar, below **Style Fields**,
expand **Editor options** and paste this into **Inline help text** (400-character
limit):

```
Paste the Stripe Payment Link (buy.stripe.com/... or your checkout domain), not a dashboard.stripe.com URL. The link's confirmation behavior must be 'redirect'.
```

If you're inside a field's settings and can't see **Editor options**, click the
**✕** next to the field's name to get back to the module level.

**2f. Publish.**
1. Check **Make available in templates and pages** (top right) is switched on.
2. Click **Publish changes**. When it's done the button greys out, meaning
   nothing is left unpublished.

#### 4B. With the HubSpot CLI

Instead of 4a–4f, if you use the
[HubSpot CLI](https://developers.hubspot.com/docs/cms/developer-reference/local-development-cli):

```powershell
npm install -g @hubspot/cli
hs init                                   # first time only: connects the CLI to your portal
hs upload module/order-form-stripe.module order-form-stripe.module
```

That uploads all five files, including [`fields.json`](module/order-form-stripe.module/fields.json) (the nine fields) and
[`meta.json`](module/order-form-stripe.module/meta.json) (label, content types and inline help text). Then open **Content** >
**Design Manager**, find **order-form-stripe.module**, and check the nine fields
are there.

✅ **Check:** open the module in Design Manager and click **Preview**. You should
see the two tabs (*YOUR INFO* / *CHECKOUT*) and your default form. The **No
errors found** line is showing and **Publish changes** is greyed out.

---

### Step 3: Put the module on your order page

*About 15 minutes.*

**3a. Get the step-1 form ready.**
1. **Marketing** > **Forms**. Open the form buyers will fill in, or create one with
   **First name**, **Last name**, **Email** (required) and **Phone number**.
2. Set what happens after submit to a **thank-you message**, not a redirect. In
   the legacy form editor it's **Options** > *"What should happen after someone
   submits?"* > **Display a thank you message**. In the new editor it's **On
   submission** > **Show thank you message**. Leave the default message text.
3. Set the form's own **Button text** to the same words as the module's
   **Submit button label** (`Continue to Payment`).
4. **Publish** the form.

> ⚠️ **A form that redirects breaks the order form, and can charge the wrong
> price.** The module detects submission by watching the form's fields disappear.
> A redirect navigates away before that happens. In the original build a page
> whose form redirected to a different payment link sold the full-price product
> instead of the cheaper plan the page advertised. The module's HubL tag already forces an inline
> response, but set the form correctly anyway, so the same form is safe
> anywhere else it's used.

> ⚠️ **Why match the button text:** HubSpot resets the submit button's text
> behind the module's back, so a mismatch makes it flash from *Continue to
> Payment* back to *Submit* on click. The module re-applies its label for 3
> seconds after a click, and matching the form removes the flash entirely.

> ⚠️ **If the form shows its thank-you message instead of fields, even in a
> private window,** the form itself is broken, not your browser. Open the form's
> share link on its own to confirm. In the original build a form made in the new
> form editor always served its thank-you state; rebuilding it in the **legacy
> form editor** fixed it.

**3b. Add the module to the page.**
1. Open the order page in the page editor (**Content** > **Landing pages** or
   **Website pages** > hover the page > **Edit**).
2. Click **+** (**Add**) in the left toolbar, search `Order Form (Stripe)`, and drag
   it into the section where the order form goes.
3. Remove anything else that sends buyers to checkout: a separate form module
   pointing at the same form, a HubSpot **Payment** module, a Stripe buy button, or
   a redirect module. Use the **Contents** tree in the left toolbar to find them.

**3c. Fill in the module settings.** Click the module. Its panel opens on the
**Content** tab.
1. **Form (step 1):** pick the form from 3a. Its fields appear under **Form
   fields**, editable in place.
2. **Stripe Link:** paste the URL you copied in [UTM repo Step 1c](https://github.com/carljibrilsulaimanii/hubspot-stripe-utm-attribution#step-1-set-every-stripe-payment-link-to-redirect).
3. **Submit button label:** `Continue to Payment`, or your own wording.
4. **Prefill email on Stripe:** on. Stripe shows a prefilled email read-only,
   which is what ties the payment to the contact.
5. **Open checkout in a new tab:** off. The redirect runs after the form's
   asynchronous submit, so most browsers block a new tab. The module then falls
   back to the same tab anyway.
6. **Test mode:** off for now.

**3d. Preview in test mode first.** *Optional, but it's the safe way to click
through checkout.*
1. In Stripe, switch to test mode, create a copy of your Payment Link there with
   the same **After payment** redirect ([UTM repo Step 1b](https://github.com/carljibrilsulaimanii/hubspot-stripe-utm-attribution#step-1-set-every-stripe-payment-link-to-redirect)), and **Copy link**.
2. In the module, paste it into **Test Stripe Link** and turn **Test mode** on.
   An amber banner appears: *"TEST MODE — this form points at a Stripe test
   payment link. No real payment will be taken. Turn Test mode off before
   publishing."*
3. Click **Preview**, fill in the form and submit. You land on the Stripe **test**
   checkout. Pay with card `4242 4242 4242 4242`, any future expiry, any CVC.
4. Turn **Test mode** off again before publishing.

> ⚠️ **Test mode never falls back to the live link.** If Test mode is on and
> **Test Stripe Link** is empty, checkout is disabled and the checkout panel says
> *"Test mode is on but no test link is set."* That's deliberate: a test page must
> not be able to take real money. The banner shows to **every** visitor, also on
> purpose, so a page published in test mode is noticed straight away.

**3e. Publish.** Click **Publish** (or **Update** for a page that's already live).

✅ **Check:** in a private window, open the **published** page with
`?utm_source=test&utm_campaign=Brand%20|%20Fall` on the end, fill in the form and
submit. The *CHECKOUT* tab turns current, *"Redirecting you to secure
checkout…"* shows for a moment, and you land on Stripe with
`utm_source=test&utm_campaign=Brand-Fall` and `prefilled_email=...` in the URL,
and your email already filled in. The pipe and spaces became `-` because Stripe
drops UTM values with any other characters.

If instead the *CHECKOUT* tab shows *"No Stripe payment link set. Open this
module's settings and paste the Stripe Payment Link URL into Stripe Link."*, the
**Stripe Link** field is empty on this page (or the variable name isn't
`stripe_link`). If you press **Back** from Stripe, the page shows a **Continue to
Payment** button instead of redirecting again. That's intended.

---

### Step 4: Test the form

*About 15 minutes.*

**4a.** Clear your test cookie on any page (browser console):
`document.cookie = 'site_attr=; domain=.example.com; path=/; max-age=0'`

**4b.** In a private window, open a **landing page** (not the order page) with a
realistic ad-style URL, pipes and spaces included:
`https://www.example.com/landing?utm_source=test&utm_medium=qa&utm_campaign=Launch%20|%20Test`

**4c.** Go through your funnel to the order page the normal way (form redirects and
all). The order page's URL will usually have no UTMs. That's the case this form handles.

**4d.** Turn on **Test mode** in the module (Step 3d) and submit the order form. On the
Stripe checkout, the address bar shows
`utm_source=test&utm_medium=qa&utm_campaign=Launch-Test&prefilled_email=...`: the
campaign cleaned of the pipes and spaces Stripe would drop.

**4e.** Pay with `4242 4242 4242 4242`. Stripe redirects you to your thank-you page,
whose URL carries the same UTMs.

**4f.** Turn **Test mode** off and republish the page. Then run the UTM repo's live
test ([Step 6b](https://github.com/carljibrilsulaimanii/hubspot-stripe-utm-attribution#step-6-test-end-to-end)) through this form to check the workflow.

✅ **Check:** the checkout URL carries your UTMs and the buyer's email, and the thank-you
page URL carries the UTMs back.

---

## 3. Test mode

- Turn on **Test mode** in the module and paste a Stripe **test** link into **Test
  Stripe Link**. Checkout then uses the test link and a bright TEST MODE banner
  shows to every visitor, so a page published by mistake is noticed at once.
- With Test mode on and no test link, checkout is **disabled**. It never falls back
  to the live link, so a test page can't take real money.
- Test payments won't reach HubSpot through a live-only sync. Use test mode to
  check the page and the Stripe URL; use a small refunded live purchase to check
  the workflow ([UTM repo Step 6](https://github.com/carljibrilsulaimanii/hubspot-stripe-utm-attribution#step-6-test-end-to-end)).
- Stripe test purchases can still trigger anything else you've connected to
  Stripe (accounting, community, Zapier). Check before running many.

---

## 4. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Checkout shows no UTMs | Header script missing on that domain, or a different cookie name | Step 1 |
| `utm_campaign` missing but `utm_source` present | A different module is on the page | Check the page uses this module (view source for `eof`) |
| Form submits but nothing happens | Form set to redirect instead of inline, or Stripe Link empty | Step 3 |
| Stuck on "Redirecting you to secure checkout..." | Navigation blocked | The module shows a pay button after 3 s; check for a popup blocker if **Open in new tab** is on |
| Payment not linked to the contact | `prefill_email` off, or the payment never completed | Turn prefill on. Stripe only creates the customer, and most syncs only link the contact, once a payment **succeeds**. |

**Debugging in the browser:** on the order page,
`document.querySelector('.eof').dataset.stripeUrl` is the link being used.

---

## 5. Security and privacy

- **The email travels in the Stripe URL** as `prefilled_email`. That's Stripe's
  documented mechanism, but the URL can appear in browser history and analytics.
  Turn prefill off if that matters more than contact matching.
- **No secrets in the module.** It only reads the campaign cookie and builds a URL.

## Related repos: Stripe beyond HubSpot Commerce

This repo is one of a set of guides for taking Stripe payments without HubSpot
Commerce, and for getting the Stripe data that HubSpot's native Stripe
integration leaves out into HubSpot. Each one stands alone.

| Repo | What it adds |
|---|---|
| [hubspot-stripe-utm-attribution](https://github.com/carljibrilsulaimanii/hubspot-stripe-utm-attribution) | UTM attribution: keeps UTMs across pages when HubSpot form redirects drop them, gets them back from Stripe on the checkout success page, and writes them onto the payment record |
| **hubspot-order-form-stripe-checkout-link-integration** (this repo) | A two-step HubSpot order form that hands buyers to a Stripe Payment Link with their email and campaign UTMs attached |
| [stripe-webhooks-to-hubspot-custom-events](https://github.com/carljibrilsulaimanii/stripe-webhooks-to-hubspot-custom-events) | Any Stripe event into a HubSpot workflow through the "Webhook event is received" trigger, no middleware |
| [hubspot-capi-server-side-lead-and-purchase-conversions-meta-google](https://github.com/carljibrilsulaimanii/hubspot-capi-server-side-lead-and-purchase-conversions-meta-google) | Stripe purchases sent server-side from HubSpot workflows to Meta and Google |
| [hubspot-stripe-zero-dollar-checkout-sync](https://github.com/carljibrilsulaimanii/hubspot-stripe-zero-dollar-checkout-sync) | Free and 100%-off Stripe Checkout orders, which create no payment, written into a HubSpot custom object, plus a backfill |
| [hubspot-stripe-payment-product-names-and-routing](https://github.com/carljibrilsulaimanii/hubspot-stripe-payment-product-names-and-routing) | Which product each Stripe payment was for, written onto the payment record, and a master workflow that routes buyers by product |
| [stripe-test-mode-to-hubspot-payment-mirror](https://github.com/carljibrilsulaimanii/stripe-test-mode-to-hubspot-payment-mirror) | Stripe test-mode payments in the same HubSpot object as live ones, so payment workflows can be tested without real charges |

---

Built by [Jibril Sulaiman](https://github.com/carljibrilsulaimanii).
