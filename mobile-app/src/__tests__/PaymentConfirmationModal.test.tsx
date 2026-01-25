import React from 'react';
import { render, fireEvent, screen, cleanup } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { PaymentConfirmationModal, PaymentPlan } from '../features/payments';

const renderWithProvider = (component: React.ReactElement) => {
  return render(<PaperProvider>{component}</PaperProvider>);
};

describe('PaymentConfirmationModal', () => {
  const mockSubscriptionPlan: PaymentPlan = {
    id: 'subscription',
    type: 'subscription',
    price: 9.99,
    currency: 'USD',
    duration: 'monthly',
    features: ['Ad-free experience', 'Premium features', 'Priority support'],
  };

  const mockLifetimePlan: PaymentPlan = {
    id: 'lifetime',
    type: 'one-time',
    price: 49.99,
    currency: 'USD',
    duration: 'lifetime',
    features: ['Ad-free experience', 'Lifetime access', 'Priority support'],
  };

  const defaultProps = {
    visible: true,
    plan: mockSubscriptionPlan,
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    isProcessing: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    cleanup();
  });

  it('should not render when not visible', () => {
    renderWithProvider(<PaymentConfirmationModal {...defaultProps} visible={false} />);
    
    expect(screen.queryByText('Confirm Subscribe')).toBeNull();
  });

  it('should not render when plan is null', () => {
    renderWithProvider(<PaymentConfirmationModal {...defaultProps} plan={null} />);
    
    expect(screen.queryByText('Confirm Subscribe')).toBeNull();
  });

  it('should render subscription plan confirmation', () => {
    renderWithProvider(<PaymentConfirmationModal {...defaultProps} />);

    expect(screen.getByText('Confirm Subscribe')).toBeTruthy();
    expect(screen.getByText('Monthly Premium')).toBeTruthy();
    expect(screen.getByText('$9.99')).toBeTruthy();
    expect(screen.getByText('/monthly')).toBeTruthy();
    expect(screen.getByText('You will get monthly subscription with the following features:')).toBeTruthy();
    expect(screen.getByText('Ad-free experience')).toBeTruthy();
    expect(screen.getByText('Premium features')).toBeTruthy();
    expect(screen.getByText('Priority support')).toBeTruthy();
    expect(screen.getByText('Subscribe Now')).toBeTruthy();
  });

  it('should render lifetime plan confirmation', () => {
    renderWithProvider(<PaymentConfirmationModal {...defaultProps} plan={mockLifetimePlan} />);

    expect(screen.getByText('Confirm Purchase')).toBeTruthy();
    expect(screen.getByText('Lifetime Premium')).toBeTruthy();
    expect(screen.getByText('$49.99')).toBeTruthy();
    expect(screen.getByText('one-time')).toBeTruthy();
    expect(screen.getByText('You will get lifetime access with the following features:')).toBeTruthy();
    expect(screen.getByText('Lifetime access')).toBeTruthy();
    expect(screen.getByText('Purchase Now')).toBeTruthy();
  });

  it('should show subscription disclaimer', () => {
    renderWithProvider(<PaymentConfirmationModal {...defaultProps} />);

    expect(
      screen.getByText(
        'Your subscription will automatically renew monthly. You can cancel anytime from your account settings.'
      )
    ).toBeTruthy();
  });

  it('should show lifetime disclaimer', () => {
    renderWithProvider(<PaymentConfirmationModal {...defaultProps} plan={mockLifetimePlan} />);

    expect(
      screen.getByText('This is a one-time purchase that gives you lifetime premium access.')
    ).toBeTruthy();
  });

  it('should call onConfirm when confirm button is pressed', () => {
    const onConfirm = jest.fn();
    renderWithProvider(<PaymentConfirmationModal {...defaultProps} onConfirm={onConfirm} />);

    fireEvent.press(screen.getByText('Subscribe Now'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when cancel button is pressed', () => {
    const onCancel = jest.fn();
    renderWithProvider(<PaymentConfirmationModal {...defaultProps} onCancel={onCancel} />);

    fireEvent.press(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should show processing state', () => {
    renderWithProvider(<PaymentConfirmationModal {...defaultProps} isProcessing={true} />);

    // Should show "Processing..." text instead of "Subscribe Now"
    expect(screen.getByText('Processing...')).toBeTruthy();
    expect(screen.queryByText('Subscribe Now')).toBeNull();

    // Cancel button should still be visible
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('should disable buttons during processing', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    
    renderWithProvider(
      <PaymentConfirmationModal
        {...defaultProps}
        onConfirm={onConfirm}
        onCancel={onCancel}
        isProcessing={true}
      />
    );

    fireEvent.press(screen.getByText('Processing...'));
    fireEvent.press(screen.getByText('Cancel'));

    // Should not call handlers when disabled
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('should render all plan features', () => {
    const planWithManyFeatures: PaymentPlan = {
      ...mockSubscriptionPlan,
      features: [
        'Ad-free experience',
        'Premium features',
        'Priority support',
        'Exclusive content',
        'Advanced analytics',
      ],
    };

    renderWithProvider(<PaymentConfirmationModal {...defaultProps} plan={planWithManyFeatures} />);

    planWithManyFeatures.features.forEach((feature) => {
      expect(screen.getByText(feature)).toBeTruthy();
    });
  });
});