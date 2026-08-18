export type SmsSendResult = {
  success: boolean;
  provider: string;
  response: string;
};

export interface SmsProvider {
  readonly name: string;
  sendSms(phone: string, message: string): Promise<SmsSendResult>;
}
