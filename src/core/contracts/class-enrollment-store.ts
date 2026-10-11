import type { ClientChannelKind } from '@/core/model/support-message.js';

export type EnrollmentConfirmationStatus =
  'pending' | 'sent' | 'failed' | 'unavailable';
export interface EnrollmentConfirmationNotification {
  enrollmentId: string;
  operatorMessageId: string;
}
export interface ClassEnrollmentStore {
  findAwaitingEnrollmentConfirmation(
    channel: ClientChannelKind,
    conversationId: string,
    checkedAt: Date,
  ): string | undefined;
  findClassEnrollment(
    requestId: string,
    externalMessageId: string,
  ): { id: string; text: string } | undefined;
  confirmClassEnrollment(
    enrollmentId: string,
    operatorTopicId: string,
    operatorMessageId: string,
    confirmedAt: Date,
  ): EnrollmentConfirmationStatus;
  findEnrollmentNotifications(
    availableBefore: Date,
  ): readonly EnrollmentConfirmationNotification[];
  markEnrollmentNotification(
    enrollmentId: string,
    notifiedAt: Date,
    sent: boolean,
  ): void;
}
