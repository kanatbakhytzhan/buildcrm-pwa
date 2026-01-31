const sanitizePhone = (phone: string) => phone.replace(/[^\d+]/g, '')

export const sanitizePhoneForTel = (phone: string) => {
  const value = sanitizePhone(phone).replace(/(?!^\+)\+/g, '')
  return value
}

export const sanitizePhoneForWa = (phone: string) => {
  const value = sanitizePhone(phone).replace(/\D/g, '')
  return value
}
