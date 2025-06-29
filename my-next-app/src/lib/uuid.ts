// Преобразует UUID в base64 для совместимости с бэкендом
export function uuidToBase64(uuid: string): string {
  // Удаляем дефисы и преобразуем в hex-строку
  const hex = uuid.replace(/-/g, '');
  
  // Конвертируем hex-строку в бинарные данные
  const byteArray = new Uint8Array(16);
  for (let i = 0; i < 32; i += 2) {
    byteArray[i/2] = parseInt(hex.substr(i, 2), 16);
  }
  
  // Конвертируем бинарные данные в строку
  let binary = '';
  for (let i = 0; i < byteArray.length; i++) {
    binary += String.fromCharCode(byteArray[i]);
  }
  
  // Возвращаем base64 без padding
  return btoa(binary).replace(/=+$/, '');
}

// Преобразует base64 в UUID строку
export function base64ToUUID(base64: string): string {
  try {
    // Добавляем padding при необходимости
    const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
    
    // Декодируем base64 в бинарную строку
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    
    // Конвертируем в байтовый массив
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    // Конвертируем байты в hex-строку
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    
    // Форматируем в стандартный UUID вид
    return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`;
  } catch (error) {
    console.error('Invalid base64 UUID:', base64, error);
    return 'invalid-uuid';
  }
}

// Тестовые функции (можно удалить в продакшене)
export function testUUIDConversion() {
  const testUUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
  
  // Преобразуем UUID в base64 и обратно
  const base64 = uuidToBase64(testUUID);
  const converted = base64ToUUID(base64);
  
  console.log('Original UUID:', testUUID);
  console.log('Base64 representation:', base64);
  console.log('Converted back:', converted);
  console.log('Match:', testUUID === converted ? '✅' : '❌');
  
  return testUUID === converted;
}

export function normalizeUUID(id: string | undefined): string {
  if (!id || id.trim() === '') {
    return '';
  }
  
  // Если ID уже в формате UUID, возвращаем как есть
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (uuidRegex.test(id)) {
    return id.toLowerCase();
  }
  
  // Пробуем преобразовать из base64
  try {
    return base64ToUUID(id);
  } catch (error) {
    console.warn("Failed to normalize UUID:", id, error);
    return id; // Возвращаем оригинальное значение как fallback
  }
}

// Вспомогательная функция для проверки валидности UUID
function isValidUUID(id: string): boolean {
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    return uuidRegex.test(id);
}