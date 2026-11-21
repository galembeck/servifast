# Next.js SaaS + RBAC

This project contains all the necessary boilerplate to setup a multi-tenant SaaS with Next.js including authentication and RBAC authorization.

## Features

### Authentication

- [x] It should be able to authenticate using e-mail/CPF & password;
- [x] It should be able to recover password using e-mail;
- [x] It should be able to create an account (e-mail, name and password);

### Restaurants

- [ ] It should be able to create a new restaurant;
- [ ] It should be able to get restaurants to which the user belongs;
- [ ] It should be able to update a restaurant;
- [ ] It should be able to shutdown a restaurant;
- [ ] It should be able to transfer restaurant ownership;

### Invites

- [ ] It should be able to invite a new member (e-mail, role);
- [ ] It should be able to accept an invite;
- [ ] It should be able to revoke a pending invite;

### Members

- [ ] It should be able to get restaurant members;
- [ ] It should be able to update a member role;

### Projects

- [ ] It should be able to get projects within a restaurant;
- [ ] It should be able to create a new project (name, url, description);
- [ ] It should be able to update a project (name, url, description);
- [ ] It should be able to delete a project;

### Billing

- [ ] It should be able to get billing details for restaurant ($20 per project / $10 per member excluding billing role);

## RBAC

Roles & permissions. `packages/rbac` defines these via CASL (`@casl/ability`); the `Role` enum lives in `packages/rbac/src/types/role.ts` and `apps/api/prisma/schema.prisma`.

### Roles

- **OWNER** — full access (`manage all`). Same as the old template's ADMIN, restaurant-branded.
- **MANAGER** — runs day-to-day floor operations: orders, tables, menu, shifts, staff invites; can view (not manage) billing.
- **WAITER** — takes/manages orders, views/updates tables, views the menu.
- **CASHIER** — processes order payments, opens/closes the register (shift), views billing.
- **KITCHEN** — views/updates orders (prep status), views the menu.
- **BILLING** — manages billing/financial reporting; views orders for reconciliation.
- **Anonymous** — no membership, no access.

`Order`, `Table`, `Menu`, and `Shift` are defined as CASL subjects (`packages/rbac/src/subjects/`). `Shift` backs the cash register (`CashRegisterSession`/`CashRegisterTransaction` models, `/restaurants/:slug/cash-register/*` routes): `get` to view the register and its movements, `manage` to open it, record supplies/withdrawals and close it.

### Permissions table

|                          | Owner | Manager | Waiter | Cashier | Kitchen | Billing | Anonymous |
| ------------------------ | ----- | ------- | ------ | ------- | ------- | ------- | --------- |
| Update restaurant      | ⚠️    | ❌      | ❌     | ❌      | ❌      | ❌      | ❌        |
| Delete restaurant      | ✅    | ❌      | ❌     | ❌      | ❌      | ❌      | ❌        |
| Transfer ownership       | ⚠️    | ❌      | ❌     | ❌      | ❌      | ❌      | ❌        |
| Invite a member          | ✅    | ✅      | ❌     | ❌      | ❌      | ❌      | ❌        |
| Revoke an invite         | ✅    | ✅      | ❌     | ❌      | ❌      | ❌      | ❌        |
| List members             | ✅    | ✅      | ❌     | ❌      | ❌      | ❌      | ❌        |
| Update member role       | ✅    | ✅      | ❌     | ❌      | ❌      | ❌      | ❌        |
| Delete member            | ✅    | ❌      | ❌     | ❌      | ❌      | ❌      | ❌        |
| Manage orders            | ✅    | ✅      | ✅¹    | ✅²     | ✅²     | ❌      | ❌        |
| View orders               | ✅    | ✅      | ✅     | ✅      | ✅      | ✅      | ❌        |
| Request bill (table → Conta) | ✅  | ✅      | ✅     | ❌      | ❌      | ❌      | ❌        |
| Close tab (checkout)⁴     | ✅    | ✅      | ❌     | ✅      | ❌      | ❌      | ❌        |
| Force-cancel order item³  | ✅    | ✅      | ❌     | ❌      | ❌      | ❌      | ❌        |
| Manage tables            | ✅    | ✅      | ✅²    | ✅⁵     | ❌      | ❌      | ❌        |
| Manage menu               | ✅    | ✅      | ❌     | ❌      | ❌      | ❌      | ❌        |
| View menu                 | ✅    | ✅      | ✅     | ❌      | ✅      | ❌      | ❌        |
| Manage shift/register⁵    | ✅    | ✅      | ❌     | ✅      | ❌      | ❌      | ❌        |
| View sales dashboard⁶     | ✅    | ❌      | ❌     | ❌      | ❌      | ✅      | ❌        |
| Get billing details      | ✅    | ✅      | ❌     | ✅      | ❌      | ✅      | ❌        |
| Manage billing            | ✅    | ❌      | ❌     | ❌      | ❌      | ✅      | ❌        |
| List/manage projects\*   | ✅    | ❌      | ❌     | ❌      | ❌      | ❌      | ❌        |

> ✅ = allowed  ❌ = not allowed  ⚠️ = allowed w/ conditions
>
> ¹ WAITER can create/view/update orders (not delete). ² CASHIER/KITCHEN can view/update orders but not create; WAITER can view/update tables but not delete.
>
> ³ Items already sent to the kitchen can't be cancelled normally. OWNER/MANAGER (`force_cancel` on `Order`) can still cancel them by sending `{ "force": true }`; the UI labels this as a "cancelamento forçado".
>
> ⁴ `close` on `Order`: registers the payment (cash, credit/debit card or PIX), closes the tab and frees the table — `POST /restaurants/:slug/tabs/:tabId/close`.
>
> ⁶ `get` on `Report`: the sales dashboard — `GET /restaurants/:slug/reports/sales?period=today|week|month`. OWNER gets it through `manage all`; BILLING is granted `get` explicitly.
>
> ⁵ `manage` on `Shift`: opens the cash register with the opening float, records supplies (suprimento) and withdrawals (sangria), and closes it with a blind count — `POST /restaurants/:slug/cash-register/{open,transactions,close}`. Every movement stores the operator and is immutable (UPDATEs are rejected by a database trigger).
>
> ⁵ CASHIER can only view tables (`get` on `Table`), to find the tab to close.
>
> \* Projects are a leftover from the original SaaS template's multi-tenancy layer, not part of the restaurant domain — only OWNER can touch them via `manage all`.

#### Conditions

- Only the restaurant's owner (`ownerId === user.id`) may transfer ownership or update the restaurant, even as OWNER.
