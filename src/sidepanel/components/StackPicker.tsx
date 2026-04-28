import {
  FRONTEND_STACKS,
  DESIGN_SKILLS,
  type FrontendStackId,
  type DesignSkillId,
} from '@/shared/constants';

interface Props {
  frontendStack: FrontendStackId;
  designSkill: DesignSkillId;
  onFrontendStackChange: (id: FrontendStackId) => void;
  onDesignSkillChange: (id: DesignSkillId) => void;
}

export function StackPicker({
  frontendStack,
  designSkill,
  onFrontendStackChange,
  onDesignSkillChange,
}: Props) {
  return (
    <div className="mt-4 flex w-full max-w-md flex-col gap-3">
      {/* Frontend Stack */}
      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-gaspoll-500"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          Frontend Stack
        </label>
        <select
          value={frontendStack}
          onChange={(e) => onFrontendStackChange(e.target.value as FrontendStackId)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-gaspoll-500 focus:outline-none focus:ring-1 focus:ring-gaspoll-500"
          aria-label="Frontend Stack"
          id="stack-picker-frontend"
        >
          {FRONTEND_STACKS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Design Skill */}
      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-gaspoll-500"
          >
            <path d="M12 19l7-7 3 3-7 7-3-3z" />
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
            <path d="M2 2l7.586 7.586" />
            <circle cx="11" cy="11" r="2" />
          </svg>
          Design Skill
        </label>
        <select
          value={designSkill}
          onChange={(e) => onDesignSkillChange(e.target.value as DesignSkillId)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-gaspoll-500 focus:outline-none focus:ring-1 focus:ring-gaspoll-500"
          aria-label="Design Skill"
          id="stack-picker-design"
        >
          {DESIGN_SKILLS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
