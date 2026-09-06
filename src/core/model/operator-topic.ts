export const webOperatorTopicPrefix = 'web:';

export function createWebOperatorTopicId(requestId: string): string {
  return `${webOperatorTopicPrefix}${requestId}`;
}

export function isWebOperatorTopic(operatorTopicId: string): boolean {
  return operatorTopicId.startsWith(webOperatorTopicPrefix);
}
