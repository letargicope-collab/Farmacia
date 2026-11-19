import { HeartPulse, Thermometer, ChevronRight } from 'lucide-react';
import { CARE_GROUPS } from '../lib/care-search';
import { useUI } from '../state/store';
import { HealthDocumentActions } from './HealthDocuments';

type Group = (typeof CARE_GROUPS)[number]['id'];

function CareIcon({ group }: { group: Group }) {
  const shared = { width: 30, height: 30, strokeWidth: 1.7, 'aria-hidden': true } as const;
  if (group === 'pain-fever') return <Thermometer {...shared} />;
  if (group === 'pressure-ongoing') return <HeartPulse {...shared} />;
  return (
    <svg {...shared} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      {group === 'cold-cough' ? <>
        <path d="M14.5 3.5v8.2l-4.2 4.1m7.2-12.3v8.2l4.2 4.1" />
        <path d="M11.6 8.1c-2.4-1.9-6.9 5.4-8.1 11.1-.8 3.9-.8 7.6 1.2 8.2 2.1.6 7-1 8.6-3.6 1.1-1.8.5-6.8.2-9.4m6.9-6.3c2.4-1.9 6.9 5.4 8.1 11.1.8 3.9.8 7.6-1.2 8.2-2.1.6-7-1-8.6-3.6-1.1-1.8-.5-6.8-.2-9.4" />
      </> : group === 'digestion' ? <>
        <path d="M14.7 3v5.4c0 2 1.3 3.2 3.1 3.1 1.8-.2 3.1-2.5 5.7-2.5 4.1 0 5.4 3.6 4.9 7.2-.8 6.4-6.1 11.3-11.6 10.7-2.1-.2-3.7-1.4-5.6-1.2-2.4.3-3.8 1.7-4.3 3.3L4 27.7c.6-3.3 3.7-6.8 7-7.5 2.4-.5 3.5-1.5 3.3-3.4-.3-2.5-3.8-4.7-3.8-8.6V3" />
        <path d="M19.6 21.6c2.5-1.1 4-3.1 4.5-5.4" />
      </> : <>
        <path d="M3.7 6.8h24.6v8.1c-.2 6-6.5 11.6-12.3 13-5.8-1.4-12.1-7-12.3-13z" />
        <path d="M4 11.5h24M4.8 16c5.4.2 8.7 4.2 8.9 9.3M27.2 16c-5.4.2-8.7 4.2-8.9 9.3M9.3 8.8v4.5m13.4-4.5v4.5" />
      </>}
    </svg>
  );
}

export function CareShortcuts() {
  const { applySearch, searchTerm } = useUI();
  return (
    <section className="care-shortcuts" aria-labelledby="care-heading">
      <div className="care-access-layout mx-auto w-full min-w-0 max-w-7xl px-4 py-5 sm:px-6 lg:py-6">
        <div className="care-heading-row">
          <h2 id="care-heading">Buscar por sintoma ou cuidado</h2>
          <p>Toque em uma opção para ver os produtos.</p>
        </div>
        <HealthDocumentActions />
        <div className="care-grid">
          {CARE_GROUPS.map(group => (
            <button key={group.id} type="button" className="care-tile" aria-pressed={searchTerm === group.label} onClick={() => applySearch(group.label)}>
              <span className={`care-icon care-icon-${group.id}`}><CareIcon group={group.id} /></span>
              <span className="care-tile-name">{group.label}</span>
              <ChevronRight aria-hidden="true" className="care-chevron" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}