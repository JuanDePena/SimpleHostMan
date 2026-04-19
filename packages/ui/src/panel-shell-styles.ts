export function renderPanelShellStyleBlock(): string {
  return `
      .page {
        width: min(103rem, calc(100vw - 1.2rem));
        margin: 0.6rem auto 1.1rem;
      }

      .hero {
        display: grid;
        gap: 0.55rem;
        padding: 0.84rem;
        border: 1px solid var(--line);
        border-radius: var(--radius-hero);
        background:
          linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(236, 244, 251, 0.96)),
          linear-gradient(90deg, rgba(16, 39, 68, 0.06), rgba(183, 243, 77, 0.06));
        box-shadow: 0 1.5rem 4rem rgba(16, 39, 68, 0.14);
      }

      .hero-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.8rem;
      }

      .hero-copy {
        display: grid;
        gap: 0.08rem;
        min-width: 0;
      }

      .hero-eyebrow {
        margin: 0;
        color: var(--navy-soft);
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: var(--font-size-kicker);
      }

      h1 {
        margin: 0;
        font-size: var(--font-size-hero);
        line-height: 0.95;
      }

      .hero-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        align-items: center;
        gap: 0.35rem;
        margin-left: auto;
      }

      .login-shell {
        padding-top: 0.75rem;
        margin-top: 0.6rem;
      }

      .login-card {
        width: min(100%, 40rem);
        margin: 0 auto;
        padding: 0.9rem 0.88rem 0.84rem;
        border-radius: var(--radius-hero);
        box-shadow: 0 1.25rem 2.8rem rgba(16, 39, 68, 0.14);
      }

      .login-card h2 {
        margin-bottom: 0.55rem;
        font-size: var(--font-size-heading-md);
      }

      .login-card .stack {
        gap: 0.58rem;
      }

      .login-card input {
        min-height: 2.28rem;
        padding: 0.58rem 0.72rem;
      }

      .login-card button {
        min-height: 2.3rem;
        font-size: 0.9rem;
      }

      @media (max-width: 720px) {
        .page {
          width: min(100vw - 0.6rem, 103rem);
        }

        .hero,
        .panel {
          padding: 0.78rem;
        }

        .hero-row {
          align-items: flex-start;
          flex-direction: column;
        }

        .hero-actions {
          width: 100%;
          margin-left: 0;
        }
      }
  `;
}
