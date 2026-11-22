import React, { useState } from 'react';
import { Blocks, Plus, Trash2, Workflow } from 'lucide-react';
import { StudioField, StudioModel, WorkflowAutomation } from '../types/erp';

interface StudioViewProps {
  models: StudioModel[];
  automations: WorkflowAutomation[];
  onCreateModel: (payload: {
    name: string;
    category: string;
    description: string;
    fields: StudioField[];
  }) => Promise<void>;
  onCreateAutomation: (payload: {
    name: string;
    trigger: string;
    condition: string;
    action: string;
  }) => Promise<void>;
}

export const StudioView: React.FC<StudioViewProps> = ({
  models,
  automations,
  onCreateModel,
  onCreateAutomation,
}) => {
  const [modelName, setModelName] = useState('');
  const [modelCategory, setModelCategory] = useState('Supply Chain');
  const [modelDesc, setModelDesc] = useState('');
  const [fields, setFields] = useState<StudioField[]>([
    { id: 'f-init', name: 'x_reference', label: 'Reference Code', type: 'text', required: true },
  ]);

  const [autoName, setAutoName] = useState('');
  const [autoTrigger, setAutoTrigger] = useState('On POS Order Paid');
  const [autoCondition, setAutoCondition] = useState('total >= 25000');
  const [autoAction, setAutoAction] = useState('Email Finance Manager & Tag VIP');
  const [saving, setSaving] = useState(false);

  const addFieldRow = () => {
    setFields((prev) => [
      ...prev,
      {
        id: `f-${Date.now()}`,
        name: `x_field_${prev.length + 1}`,
        label: `Custom Field ${prev.length + 1}`,
        type: 'text',
        required: false,
      },
    ]);
  };

  const handleSaveModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelName.trim() || fields.length === 0) return;
    setSaving(true);
    try {
      await onCreateModel({
        name: modelName.trim(),
        category: modelCategory,
        description: modelDesc.trim(),
        fields,
      });
      setModelName('');
      setModelDesc('');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAutomation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!autoName.trim()) return;
    setSaving(true);
    try {
      await onCreateAutomation({
        name: autoName.trim(),
        trigger: autoTrigger,
        condition: autoCondition,
        action: autoAction,
      });
      setAutoName('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
          Misafa Studio · Custom Models & Workflow Automation
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Tailor database schemas, custom retail fields, and automated operational triggers without touching core code.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Custom Model Builder */}
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Blocks className="h-4 w-4 text-teal-700 dark:text-teal-400" />
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Create Custom Database Model
            </h2>
          </div>

          <form onSubmit={handleSaveModel} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="text"
                required
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="Model Name (e.g. Supplier Rebate Tiers)"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <select
                value={modelCategory}
                onChange={(e) => setModelCategory(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="Supply Chain">Supply Chain</option>
                <option value="Finance & Tax">Finance & Tax</option>
                <option value="Sales & POS">Sales & POS</option>
                <option value="Human Resources">Human Resources</option>
              </select>
            </div>

            <input
              type="text"
              value={modelDesc}
              onChange={(e) => setModelDesc(e.target.value)}
              placeholder="Short operational purpose..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />

            <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Schema Fields
                </span>
                <button
                  type="button"
                  onClick={addFieldRow}
                  className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline dark:text-teal-400"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Field</span>
                </button>
              </div>

              {fields.map((f, idx) => (
                <div key={f.id} className="grid grid-cols-12 gap-2">
                  <input
                    type="text"
                    value={f.label}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFields((prev) =>
                        prev.map((row, i) =>
                          i === idx
                            ? {
                                ...row,
                                label: val,
                                name: `x_${val.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
                              }
                            : row
                        )
                      );
                    }}
                    placeholder="Field Label"
                    className="col-span-5 rounded border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <select
                    value={f.type}
                    onChange={(e) => {
                      const val = e.target.value as StudioField['type'];
                      setFields((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, type: val } : row))
                      );
                    }}
                    className="col-span-5 rounded border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="currency">Currency (KES)</option>
                    <option value="date">Date</option>
                    <option value="boolean">Checkbox</option>
                    <option value="relation">Relation</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setFields((prev) => prev.filter((_, i) => i !== idx))}
                    className="col-span-2 flex items-center justify-center rounded border border-slate-200 text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:hover:bg-rose-950/40"
                    aria-label="Remove field"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-600"
            >
              Deploy Studio Model
            </button>
          </form>
        </section>

        {/* Workflow Automation Builder */}
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-teal-700 dark:text-teal-400" />
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Create Workflow Automation Rule
            </h2>
          </div>

          <form onSubmit={handleSaveAutomation} className="space-y-3">
            <input
              type="text"
              required
              value={autoName}
              onChange={(e) => setAutoName(e.target.value)}
              placeholder="Rule Name (e.g. Notify Regional Manager on High Value Sale)"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select
                value={autoTrigger}
                onChange={(e) => setAutoTrigger(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option>On POS Order Paid</option>
                <option>On Inventory Stock Update</option>
                <option>On Field Agent Sync</option>
                <option>On Payroll Run Approved</option>
              </select>
              <input
                type="text"
                value={autoCondition}
                onChange={(e) => setAutoCondition(e.target.value)}
                placeholder="Condition expression"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <input
              type="text"
              value={autoAction}
              onChange={(e) => setAutoAction(e.target.value)}
              placeholder="Action (e.g. Create PO & Send Email Alert)"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-teal-600"
            >
              Activate Automation
            </button>
          </form>

          <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Active Automations ({automations.length})
            </h3>
            <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
              {automations.map((a) => (
                <div key={a.id} className="py-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {a.name}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-emerald-700 dark:text-emerald-400">
                      {a.executions} runs
                    </span>
                  </div>
                  <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                    {a.trigger} · If <span className="font-mono">{a.condition}</span> → {a.action}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Deployed Studio Models */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
          Deployed Custom Models ({models.length})
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {models.map((m) => (
            <div
              key={m.id}
              className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
            >
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {m.name}
                </h3>
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  {m.technicalName}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{m.description}</p>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                {m.fields.map((f) => (
                  <span key={f.id} className="font-mono">
                    {f.label} ({f.type})
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
