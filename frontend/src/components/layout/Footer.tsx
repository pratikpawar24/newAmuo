export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-6 dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl px-4 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          © {new Date().getFullYear()} <span className="font-semibold text-primary-500">AUMO v2</span> — AI-Powered Urban Mobility Optimizer
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Built with Next.js, Express, FastAPI & PyTorch | Reducing carbon footprints one ride at a time 🌿
        </p>
      </div>
    </footer>
  );
}
