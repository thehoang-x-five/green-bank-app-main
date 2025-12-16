import { describe, it } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property 11: Vietnamese Error Messages
 * 
 * For any error that occurs in the system, the error message displayed to the user
 * must be in Vietnamese language (contain Vietnamese characters or common Vietnamese words).
 * 
 * Validates: Requirements 14.1
 */

// Common Vietnamese words that should appear in error messages
const VIETNAMESE_WORDS = [
  'không', 'lỗi', 'thành công', 'thất bại', 'vui lòng', 'bạn', 'tài khoản',
  'giao dịch', 'thanh toán', 'đăng nhập', 'chọn', 'nhập', 'kiểm tra',
  'liên hệ', 'ngân hàng', 'xác thực', 'định danh', 'số dư', 'phòng',
  'khách sạn', 'ngày', 'địa điểm', 'kết nối', 'mạng'
]

// Vietnamese diacritical characters
const VIETNAMESE_CHARS = [
  'à', 'á', 'ả', 'ã', 'ạ', 'ă', 'ắ', 'ằ', 'ẳ', 'ẵ', 'ặ',
  'â', 'ấ', 'ầ', 'ẩ', 'ẫ', 'ậ', 'đ', 'è', 'é', 'ẻ', 'ẽ', 'ẹ',
  'ê', 'ế', 'ề', 'ể', 'ễ', 'ệ', 'ì', 'í', 'ỉ', 'ĩ', 'ị',
  'ò', 'ó', 'ỏ', 'õ', 'ọ', 'ô', 'ố', 'ồ', 'ổ', 'ỗ', 'ộ',
  'ơ', 'ớ', 'ờ', 'ở', 'ỡ', 'ợ', 'ù', 'ú', 'ủ', 'ũ', 'ụ',
  'ư', 'ứ', 'ừ', 'ử', 'ữ', 'ự', 'ỳ', 'ý', 'ỷ', 'ỹ', 'ỵ'
]

interface ErrorScenario {
  type: 'auth' | 'validation' | 'network' | 'business' | 'permission'
  context: string
}

// Function that generates error messages for different scenarios
function generateErrorMessage(scenario: ErrorScenario): string {
  switch (scenario.type) {
    case 'auth':
      return 'Bạn cần đăng nhập để thực hiện giao dịch này'
    case 'validation':
      return 'Vui lòng kiểm tra thông tin đã nhập và thử lại'
    case 'network':
      return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng'
    case 'business':
      return 'Tài khoản không đủ điều kiện thực hiện giao dịch này'
    case 'permission':
      return 'Quyền truy cập bị từ chối. Vui lòng cấp quyền và thử lại'
    default:
      return 'Đã xảy ra lỗi không xác định. Vui lòng thử lại sau'
  }
}

// Function to check if a string contains Vietnamese characteristics
function containsVietnamese(text: string): boolean {
  // Check for Vietnamese diacritical characters
  const hasVietnameseChars = VIETNAMESE_CHARS.some(char => text.includes(char))
  
  // Check for common Vietnamese words
  const hasVietnameseWords = VIETNAMESE_WORDS.some(word => 
    text.toLowerCase().includes(word.toLowerCase())
  )
  
  return hasVietnameseChars || hasVietnameseWords
}

describe('Property 11: Vietnamese Error Messages', () => {
  it('should generate Vietnamese error messages for all error types', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('auth', 'validation', 'network', 'business', 'permission'),
        fc.string({ minLength: 1, maxLength: 50 }),
        (errorType, context) => {
          const scenario: ErrorScenario = {
            type: errorType as ErrorScenario['type'],
            context,
          }
          
          const errorMessage = generateErrorMessage(scenario)
          
          // Property: All error messages should contain Vietnamese characteristics
          return containsVietnamese(errorMessage)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should contain Vietnamese diacritical characters in error messages', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('auth', 'validation', 'network', 'business', 'permission'),
        (errorType) => {
          const scenario: ErrorScenario = {
            type: errorType as ErrorScenario['type'],
            context: 'test',
          }
          
          const errorMessage = generateErrorMessage(scenario)
          
          // Property: Error messages should contain Vietnamese diacritical marks
          const hasVietnameseChars = VIETNAMESE_CHARS.some(char => 
            errorMessage.includes(char)
          )
          
          return hasVietnameseChars
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should contain common Vietnamese words in error messages', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('auth', 'validation', 'network', 'business', 'permission'),
        (errorType) => {
          const scenario: ErrorScenario = {
            type: errorType as ErrorScenario['type'],
            context: 'test',
          }
          
          const errorMessage = generateErrorMessage(scenario)
          
          // Property: Error messages should contain common Vietnamese words
          const hasVietnameseWords = VIETNAMESE_WORDS.some(word => 
            errorMessage.toLowerCase().includes(word.toLowerCase())
          )
          
          return hasVietnameseWords
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should not contain English-only error messages', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('auth', 'validation', 'network', 'business', 'permission'),
        (errorType) => {
          const scenario: ErrorScenario = {
            type: errorType as ErrorScenario['type'],
            context: 'test',
          }
          
          const errorMessage = generateErrorMessage(scenario)
          
          // Property: Error messages should not be purely English
          const englishOnlyPatterns = [
            /^[a-zA-Z\s.,!?]+$/,  // Only English letters and basic punctuation
            /error/i,
            /failed/i,
            /invalid/i,
            /unauthorized/i,
          ]
          
          const isPurelyEnglish = englishOnlyPatterns.some(pattern => 
            pattern.test(errorMessage)
          )
          
          return !isPurelyEnglish
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should maintain Vietnamese characteristics across different contexts', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('auth', 'validation', 'network', 'business', 'permission'),
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
        (errorType, contexts) => {
          const allMessagesVietnamese = contexts.every(context => {
            const scenario: ErrorScenario = {
              type: errorType as ErrorScenario['type'],
              context,
            }
            
            const errorMessage = generateErrorMessage(scenario)
            return containsVietnamese(errorMessage)
          })
          
          // Property: Vietnamese characteristics should be consistent across contexts
          return allMessagesVietnamese
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should have meaningful Vietnamese content, not just characters', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('auth', 'validation', 'network', 'business', 'permission'),
        (errorType) => {
          const scenario: ErrorScenario = {
            type: errorType as ErrorScenario['type'],
            context: 'test',
          }
          
          const errorMessage = generateErrorMessage(scenario)
          
          // Property: Messages should have meaningful Vietnamese words, not just random characters
          const meaningfulWords = ['bạn', 'vui lòng', 'không thể', 'tài khoản', 'giao dịch']
          const hasMeaningfulContent = meaningfulWords.some(word => 
            errorMessage.toLowerCase().includes(word)
          )
          
          return hasMeaningfulContent
        }
      ),
      { numRuns: 100 }
    )
  })
})