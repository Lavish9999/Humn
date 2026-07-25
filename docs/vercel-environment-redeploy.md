# Vercel environment redeploys

Vercel snapshots environment variables when a deployment is created. After adding or changing any server-only detector or worker credential, create a new Preview deployment before testing the automated verification pipeline. An older deployment will continue using the previous environment snapshot.
