'use client';

interface RegistrationStepperProps {
  currentStep: number;
  totalSteps: number;
  stepLabels?: string[];
}

export default function RegistrationStepper({
  currentStep,
  totalSteps,
  stepLabels = ['School', 'Event', 'Class', 'Details'],
}: RegistrationStepperProps) {
  return (
    <div className="w-full max-w-md mx-auto mb-8">
      <div className="flex items-center justify-between">
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;

          return (
            <div key={stepNumber} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${
                      isCompleted
                        ? 'bg-sage-500 text-white'
                        : isCurrent
                        ? 'bg-sage-500 text-white ring-4 ring-sage-100'
                        : 'bg-gray-200 text-gray-500'
                    }
                  `}
                >
                  {isCompleted ? (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    stepNumber
                  )}
                </div>
                <span
                  className={`
                    text-xs mt-1.5
                    ${isCurrent ? 'text-sage-600 font-medium' : 'text-gray-500'}
                  `}
                >
                  {stepLabels[index] || `Step ${stepNumber}`}
                </span>
              </div>
              {stepNumber < totalSteps && (
                <div
                  className={`
                    flex-1 h-0.5 mx-2 mt-[-16px]
                    ${isCompleted ? 'bg-sage-500' : 'bg-gray-200'}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
