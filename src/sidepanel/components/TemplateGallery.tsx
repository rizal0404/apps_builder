import { TEMPLATES, type Template } from '@/shared/templates';

interface Props {
  onUseTemplate: (t: Template) => void;
}

const CATEGORY_LABEL: Record<Template['category'], string> = {
  'web-app': 'Web App',
  automation: 'Automation',
  sheet: 'Sheet',
  form: 'Form',
  'custom-function': 'Custom Function',
};

export function TemplateGallery({ onUseTemplate }: Props) {
  return (
    <div className="grid w-full max-w-md grid-cols-1 gap-2">
      {TEMPLATES.map((t) => (
        <button
          key={t.id}
          onClick={() => onUseTemplate(t)}
          className="group rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-gaspoll-400 hover:shadow"
        >
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-800 group-hover:text-gaspoll-700">
              {t.name}
            </div>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              {CATEGORY_LABEL[t.category]}
            </span>
          </div>
          <p className="mt-1 text-xs leading-snug text-slate-500">{t.description}</p>
          {t.bootstrap?.length ? (
            <div className="mt-2 text-[10px] font-medium text-emerald-700">
              Includes {t.bootstrap.length} starter file{t.bootstrap.length === 1 ? '' : 's'}
            </div>
          ) : null}
        </button>
      ))}
    </div>
  );
}
