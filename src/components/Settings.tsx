import { Settings as SettingsIcon, X } from 'lucide-react';
import { useState } from 'react';

interface SettingsProps {
  useHybridDetection: boolean;
  useCraftPrimary: boolean;
  useDBNet: boolean;
  onHybridToggle: (enabled: boolean) => void;
  onCraftPrimaryToggle: (enabled: boolean) => void;
  onDBNetToggle: (enabled: boolean) => void;
}

export function Settings({
  useHybridDetection,
  useCraftPrimary,
  useDBNet,
  onHybridToggle,
  onCraftPrimaryToggle,
  onDBNetToggle,
}: SettingsProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 right-4 p-3 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow border border-slate-200"
        title="Settings"
      >
        <SettingsIcon className="w-6 h-6 text-slate-700" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900">Detection Settings</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={useHybridDetection}
                          onChange={(e) => onHybridToggle(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-slate-900 block">
                          Hybrid Detection
                        </span>
                        <span className="text-xs text-slate-600 block mt-1">
                          Combine Claude AI with {useDBNet ? 'DBNet' : 'CRAFT'} for improved accuracy
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {useHybridDetection && (
                  <div className="ml-4 pl-4 border-l-2 border-slate-200 space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={useDBNet}
                          onChange={(e) => onDBNetToggle(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-slate-900 block">
                          Use DBNet
                        </span>
                        <span className="text-xs text-slate-600 block mt-1">
                          Use DBNet++ instead of CRAFT for detection
                        </span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={useCraftPrimary}
                          onChange={(e) => onCraftPrimaryToggle(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-slate-900 block">
                          {useDBNet ? 'DBNet' : 'CRAFT'}-Primary Mode
                        </span>
                        <span className="text-xs text-slate-600 block mt-1">
                          Use {useDBNet ? 'DBNet' : 'CRAFT'} for placement, Claude for text
                        </span>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <h3 className="text-sm font-semibold text-slate-900">Current Mode:</h3>
                <p className="text-sm text-slate-700">
                  {!useHybridDetection && '🤖 Claude-Only Detection'}
                  {useHybridDetection && !useCraftPrimary && `🔀 Hybrid (Claude + ${useDBNet ? 'DBNet' : 'CRAFT'} merge)`}
                  {useHybridDetection && useCraftPrimary && `🎯 ${useDBNet ? 'DBNet' : 'CRAFT'}-Primary (${useDBNet ? 'DBNet' : 'CRAFT'} placement + Claude text)`}
                </p>
                <div className="text-xs text-slate-600 mt-3 space-y-1">
                  <p><strong>Claude-Only:</strong> Fast, uses only AI vision</p>
                  <p><strong>Hybrid:</strong> Merges Claude and {useDBNet ? 'DBNet' : 'CRAFT'} detections</p>
                  <p><strong>{useDBNet ? 'DBNet' : 'CRAFT'}-Primary:</strong> Best accuracy (requires {useDBNet ? 'DBNet' : 'CRAFT'} service)</p>
                  {useDBNet && <p><strong>DBNet:</strong> Superior for document text (97.4% F1-score)</p>}
                </div>
              </div>

              {useHybridDetection && useCraftPrimary && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-xs text-amber-800">
                    <strong>Note:</strong> {useDBNet ? 'DBNet' : 'CRAFT'}-Primary mode requires a running {useDBNet ? 'DBNet' : 'CRAFT'} service.
                    If unavailable, the system will automatically fall back to Claude-based detection.
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
