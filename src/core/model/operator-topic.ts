export const webOperatorTopicPrefix = 'web:';

export function createWebOperatorTopicId(requestId: string): string {
  return `${webOperatorTopicPrefix}${requestId}`;
}

export function isWebOperatorTopic(operatorTopicId: string): boolean {
  return operatorTopicId.startsWith(webOperatorTopicPrefix);
}

export function requestIdFromWebOperatorTopic(
  operatorTopicId: string,
): string | undefined {
  if (!isWebOperatorTopic(operatorTopicId)) {
    return undefined;
  }
  const requestId = operatorTopicId.slice(webOperatorTopicPrefix.length);
  return requestId || undefined;
}
