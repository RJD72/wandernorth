# Hostinger waitlist deployment

The production Vite build sends waitlist submissions to `/api/waitlist.php`.
The PHP endpoint stores one row per email address in a Hostinger MySQL
database. A repeat signup updates that row and increments `submission_count`.

## 1. Create the database

1. In hPanel, open **Websites → Dashboard → Databases → Management**.
2. Create a MySQL database and database user.
3. Save the full database name, username, and password. Hostinger's database
   host is normally `localhost`.
4. Open phpMyAdmin for the database.
5. Import `server/waitlist-schema.sql`.

## 2. Create the private configuration

1. Copy `server/wandernorth-private.example.php`.
2. Rename the copy to `wandernorth-private.php`.
3. Replace the database placeholders.
4. Replace the example origins with the site's exact HTTPS address. Include
   both `www` and non-`www` versions only if both are used.
5. Replace `rate_limit_secret` with a long random value of at least 32
   characters.
6. Upload the completed file one directory above `public_html`.

The deployed layout should resemble:

```text
your-domain-directory/
├── wandernorth-private.php
└── public_html/
    ├── api/
    │   └── waitlist.php
    ├── assets/
    └── index.html
```

Do not place the real configuration file in the Git repository or the Vite
project. It contains the database password.

## 3. Build and upload

From `landing-page`:

```bash
npm install
npm run lint
npm run build
```

Upload the contents of `landing-page/dist` into the validation site's
`public_html` directory. Vite copies `public/api/waitlist.php` into
`dist/api/waitlist.php`, and `.env.production` gives the client the same-origin
endpoint path.

## 4. Verify production

1. Open the production page in a private browser window.
2. Submit the compact email form and confirm its success message.
3. Submit the full research form.
4. Open phpMyAdmin and inspect `waitlist_submissions`.
5. Submit the same email again. Confirm that only one row exists and
   `submission_count` increased.
6. Enter a value in the hidden `website` honeypot using browser developer tools
   and confirm no row is stored.
7. Confirm a sixth rapid attempt is rejected temporarily by the rate limiter.

If the form shows a configuration error, inspect Hostinger's PHP error log.
The endpoint logs server details there but returns only a generic message to
the visitor.
