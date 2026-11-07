import SwiftUI

// Paper-and-ink palette: warm off-white paper, black ink, pencil greys.
// Ported from mobile/src/constants/theme.ts. The app is light-only for now.
enum Palette {
    static let text = Color(hex: 0x161616)
    static let background = Color(hex: 0xF6F5F1)
    static let backgroundElement = Color(hex: 0xECEAE4)
    static let backgroundSelected = Color(hex: 0xDCD9D1)
    static let textSecondary = Color(hex: 0x8A877F)
}

/// Ink accents shared by the path, popovers and buttons.
enum Ink {
    static let ink = Color(hex: 0x161616)
    static let inkLip = Color(hex: 0x000000)
    static let pencil = Color(hex: 0xB9B5AC)
    static let paper = Color(hex: 0xFFFFFF)
    static let paperLip = Color(hex: 0xD4D0C6)
    /// The one spot colour, used sparingly (streak flame, today).
    static let red = Color(hex: 0xE5483B)
}

enum Spacing {
    static let half: CGFloat = 2
    static let one: CGFloat = 4
    static let two: CGFloat = 8
    static let three: CGFloat = 16
    static let four: CGFloat = 24
    static let five: CGFloat = 32
    static let six: CGFloat = 64
}

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }
}

/// Text styles from themed-text.tsx.
enum TextStyle {
    case `default`, title, subtitle, small, smallBold

    var font: Font {
        switch self {
        case .default: .system(size: 16, weight: .medium)
        case .title: .system(size: 48, weight: .semibold)
        case .subtitle: .system(size: 32, weight: .semibold)
        case .small: .system(size: 14, weight: .medium)
        case .smallBold: .system(size: 14, weight: .bold)
        }
    }
}

extension View {
    func textStyle(_ style: TextStyle, color: Color = Palette.text) -> some View {
        font(style.font).foregroundStyle(color)
    }
}
