'use client';

import { FIELD_KEYS, type FieldKey } from '@mailmotion/schema';
import { getIn, setIn, type Draft } from '@/lib/draft';
import { useStudioCtx } from '@/lib/useStudio';
import { Row, Section, TextField } from '../ui';

const FIELD_LABEL: Record<FieldKey, string> = {
  title: 'Job title',
  department: 'Department',
  company: 'Company',
  phones: 'Phone numbers',
  email: 'Email',
  websites: 'Websites',
  address: 'Address',
  tagline: 'Tagline',
  custom: 'Custom fields',
};

/** Add / remove / reorder rows of an array in the draft. */
export function useList(path: string, max: number, blank: () => unknown) {
  const s = useStudioCtx();
  const p = path.split('.');
  const items = (getIn(s.draft, p) as unknown[] | undefined) ?? [];
  const write = (next: unknown[]) => s.update((d: Draft) => setIn(d, p, next));
  return {
    items,
    canAdd: items.length < max,
    add: () => write([...items, blank()]),
    remove: (i: number) => write(items.filter((_, j) => j !== i)),
    move: (i: number, dir: -1 | 1) => {
      const j = i + dir;
      if (j < 0 || j >= items.length) return;
      const next = [...items];
      [next[i], next[j]] = [next[j]!, next[i]!];
      write(next);
    },
  };
}

export function ListShell({
  title,
  list,
  children,
  addLabel,
}: {
  title: string;
  list: ReturnType<typeof useList>;
  addLabel: string;
  children: (i: number) => React.ReactNode;
}) {
  return (
    <fieldset className="list">
      <legend>{title}</legend>
      {list.items.map((_, i) => (
        <div className="list-item" key={i}>
          <div className="list-fields">{children(i)}</div>
          <div className="list-ctl">
            <button
              type="button"
              className="btn ghost small"
              onClick={() => list.move(i, -1)}
              disabled={i === 0}
              aria-label={`Move ${title} ${i + 1} up`}
            >
              ↑
            </button>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => list.move(i, 1)}
              disabled={i === list.items.length - 1}
              aria-label={`Move ${title} ${i + 1} down`}
            >
              ↓
            </button>
            <button
              type="button"
              className="btn ghost small danger"
              onClick={() => list.remove(i)}
              aria-label={`Remove ${title} ${i + 1}`}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="btn small" onClick={list.add} disabled={!list.canAdd}>
        + {addLabel}
      </button>
    </fieldset>
  );
}

export function DetailsPanel() {
  const s = useStudioCtx();
  const phones = useList('details.phones', 3, () => ({ label: 'Mobile', number: '' }));
  const sites = useList('details.websites', 2, () => ({ url: '' }));
  const custom = useList('details.customFields', 3, () => ({ label: '', value: '' }));

  const order = (
    (getIn(s.draft, ['details', 'fieldOrder']) as FieldKey[] | undefined) ?? [...FIELD_KEYS]
  ).filter((k) => FIELD_KEYS.includes(k));
  const hidden = new Set((getIn(s.draft, ['details', 'hidden']) as FieldKey[] | undefined) ?? []);
  const setOrder = (next: FieldKey[]) => s.set('details.fieldOrder', next);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setOrder(next);
  };
  const toggle = (k: FieldKey) =>
    s.set('details.hidden', hidden.has(k) ? [...hidden].filter((x) => x !== k) : [...hidden, k]);

  return (
    <Section title="Your details" hint="Name, title, contact" defaultOpen id="details">
      <TextField path="details.fullName" label="Full name" max={60} />
      <Row>
        <TextField path="details.pronouns" label="Pronouns" max={20} placeholder="she/her" />
        <TextField path="details.title" label="Job title" max={80} />
      </Row>
      <Row>
        <TextField path="details.department" label="Department" max={60} />
        <TextField path="details.company" label="Company" max={80} />
      </Row>
      <TextField
        path="details.companyUrl"
        label="Company website (links the company name)"
        type="url"
        placeholder="https://example.com"
      />
      <TextField
        path="details.email"
        label="Email"
        type="email"
        hint="Optional: it is already in the From line, but some people like it shown."
      />

      <ListShell title="Phone" list={phones} addLabel="Add phone">
        {(i) => (
          <Row>
            <TextField path={`details.phones.${i}.label`} label="Label" max={20} />
            <TextField
              path={`details.phones.${i}.number`}
              label="Number"
              type="tel"
              placeholder="+60 12 345 6789"
              hint={i === 0 ? 'International format, with +' : undefined}
            />
          </Row>
        )}
      </ListShell>
      <ListShell title="Website" list={sites} addLabel="Add website">
        {(i) => (
          <Row>
            <TextField path={`details.websites.${i}.label`} label="Label (optional)" max={30} />
            <TextField
              path={`details.websites.${i}.url`}
              label="URL"
              type="url"
              placeholder="https://"
            />
          </Row>
        )}
      </ListShell>

      <TextField
        path="details.address.text"
        label="Address"
        multiline
        rows={2}
        max={120}
        hint="One or two lines."
      />
      <TextField
        path="details.address.mapUrl"
        label="Map link (optional)"
        type="url"
        placeholder="https://maps.google.com/…"
      />
      <TextField path="details.tagline" label="Tagline or quote" max={90} />
      <ListShell title="Custom field" list={custom} addLabel="Add field">
        {(i) => (
          <Row>
            <TextField
              path={`details.customFields.${i}.label`}
              label="Label"
              max={30}
              placeholder="Licence no."
            />
            <TextField path={`details.customFields.${i}.value`} label="Value" max={80} />
          </Row>
        )}
      </ListShell>

      <details className="mini">
        <summary>Field order and visibility</summary>
        <ol className="order">
          {order.map((k, i) => (
            <li key={k}>
              <label>
                <input type="checkbox" checked={!hidden.has(k)} onChange={() => toggle(k)} />{' '}
                {FIELD_LABEL[k]}
              </label>
              <span>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${FIELD_LABEL[k]} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  aria-label={`Move ${FIELD_LABEL[k]} down`}
                >
                  ↓
                </button>
              </span>
            </li>
          ))}
        </ol>
      </details>
    </Section>
  );
}
