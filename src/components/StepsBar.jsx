/**
 * StepsBar – horizontal step indicator
 */
import React from 'react';

const STEPS = [
  { label: 'Setup' },
  { label: 'Photo' },
  { label: 'Poster' },
];

export default function StepsBar({ currentStep }) {
  return (
    <div className="steps-bar" aria-label="Progress steps" style={{ marginBottom: 60, position: 'relative' }}>
      {STEPS.map((step, i) => {
        const stepNum = i + 1;
        const state =
          stepNum < currentStep ? 'completed' :
          stepNum === currentStep ? 'active' : 'inactive';

        return (
          <div key={i} className="step-item" style={{ position: 'relative' }}>
            <div className={`step-circle ${state}`} aria-label={`Step ${stepNum}: ${step.label}`}>
              {state === 'completed' ? '✓' : stepNum}
              <span className="step-label">{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`step-connector ${stepNum < currentStep ? 'active' : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
