import { VerificationResult } from '../types';
import { CheckCircle2, XCircle, AlertCircle, TrendingUp, MapPin, Palette } from 'lucide-react';

interface VerificationReportProps {
  results: VerificationResult[];
  onClose: () => void;
}

export function VerificationReport({ results, onClose }: VerificationReportProps) {
  const averageScore = results.reduce((sum, r) => sum + r.overall_similarity_score, 0) / results.length;
  const passedCount = results.filter(r => r.verification_passed).length;
  const totalMissing = results.reduce((sum, r) => sum + r.missing_elements.length, 0);
  const totalStylingDiffs = results.reduce((sum, r) => sum + r.styling_differences.length, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Conversion Quality Report</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Average Score</span>
              </div>
              <div className="text-3xl font-bold text-blue-600">{averageScore.toFixed(1)}%</div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-900">Passed</span>
              </div>
              <div className="text-3xl font-bold text-green-600">{passedCount}/{results.length}</div>
            </div>

            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                <span className="text-sm font-medium text-orange-900">Missing Elements</span>
              </div>
              <div className="text-3xl font-bold text-orange-600">{totalMissing}</div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Palette className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-medium text-purple-900">Style Issues</span>
              </div>
              <div className="text-3xl font-bold text-purple-600">{totalStylingDiffs}</div>
            </div>
          </div>

          {results.map((result, index) => (
            <div key={index} className="mb-6 border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Slide {index + 1}</h3>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-600">
                    Similarity: {result.overall_similarity_score.toFixed(1)}%
                  </span>
                  {result.verification_passed ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                </div>
              </div>

              <div className="p-4 space-y-4">
                {result.missing_elements.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-orange-600" />
                      <h4 className="font-medium text-gray-900">Missing Elements ({result.missing_elements.length})</h4>
                    </div>
                    <ul className="space-y-2 ml-6">
                      {result.missing_elements.map((elem, i) => (
                        <li key={i} className="text-sm text-black">
                          <span className="font-medium capitalize">{elem.element_type}:</span> {elem.description}
                          <span className="text-gray-500 ml-2">({elem.confidence}% confidence)</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.positioning_errors.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      <h4 className="font-medium text-gray-900">Positioning Errors ({result.positioning_errors.length})</h4>
                    </div>
                    <ul className="space-y-2 ml-6">
                      {result.positioning_errors.map((err, i) => (
                        <li key={i} className="text-sm text-black">
                          <span className="font-medium capitalize">{err.element_type}:</span> Off by {err.error_distance.toFixed(1)} pixels
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.styling_differences.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Palette className="w-4 h-4 text-purple-600" />
                      <h4 className="font-medium text-gray-900">Styling Differences ({result.styling_differences.length})</h4>
                    </div>
                    <ul className="space-y-2 ml-6">
                      {result.styling_differences.map((diff, i) => (
                        <li key={i} className="text-sm text-gray-700">
                          <span className="font-medium capitalize">{diff.element_type}</span> {diff.property}:
                          Expected <code className="bg-gray-100 px-1 rounded">{diff.expected_value}</code>,
                          Got <code className="bg-gray-100 px-1 rounded">{diff.actual_value}</code>
                          <span className={`ml-2 text-xs font-medium ${
                            diff.severity === 'high' ? 'text-red-600' :
                            diff.severity === 'medium' ? 'text-orange-600' : 'text-gray-500'
                          }`}>
                            ({diff.severity})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.suggestions.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">Improvement Suggestions</h4>
                    <ul className="space-y-1">
                      {result.suggestions.map((suggestion, i) => (
                        <li key={i} className="text-sm text-blue-800">• {suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.missing_elements.length === 0 &&
                 result.positioning_errors.length === 0 &&
                 result.styling_differences.length === 0 && (
                  <div className="text-center py-4 text-green-600 font-medium">
                    <CheckCircle2 className="w-6 h-6 mx-auto mb-2" />
                    Excellent conversion quality!
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {averageScore >= 90 ? (
              <span className="text-green-600 font-medium">Excellent quality - ready to use!</span>
            ) : averageScore >= 70 ? (
              <span className="text-blue-600 font-medium">Good quality - minor adjustments recommended</span>
            ) : averageScore >= 50 ? (
              <span className="text-orange-600 font-medium">Fair quality - review and adjust as needed</span>
            ) : (
              <span className="text-red-600 font-medium">Poor quality - significant improvements needed</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}
