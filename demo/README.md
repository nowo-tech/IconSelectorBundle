# Icon Selector Bundle — Demos

Demo applications for the bundle. They are not part of the Composer package (`archive.exclude`); use a clone of the repository to run them.

| Demo | Symfony | Directory | Default URL |
| --- | --- | --- | --- |
| Symfony 8 | 8.1 | [`symfony8/`](symfony8/README.md) | <http://localhost:8011> |

The demos run on **FrankenPHP** (Caddy + PHP). Development vs production setup, `FRANKENPHP_MODE` (`worker` by default, `classic` for per-request PHP) and troubleshooting are documented in [docs/DEMO-FRANKENPHP.md](../docs/DEMO-FRANKENPHP.md).

From the bundle root:

```bash
make -C demo up-symfony8
```

Copy `symfony8/.env.example` to `symfony8/.env` on first run (the demo `make up` does it for you); `.env`, `.env.dev` and `.env.*.local` are not committed.
