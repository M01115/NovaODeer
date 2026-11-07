import SwiftUI

#if canImport(UIKit)
import UIKit
#endif

// Shared UI pieces. Ported from mobile/src/components/.

/// Haptic nudges (no-ops where there's no Taptic Engine).
enum Haptics {
    static func light() {
        #if os(iOS)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        #endif
    }

    static func warning() {
        #if os(iOS)
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
        #endif
    }

    static func success() {
        #if os(iOS)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        #endif
    }
}

/// A sketch on paper: the uploaded photo, or the prompt's emoji as a stand-in.
struct SketchThumb: View {
    enum Shape { case circle, card }

    let size: CGFloat
    var imageURL: URL? = nil
    /// Shown when there's no image yet (mock data).
    let emoji: String
    var shape: Shape = .circle

    var body: some View {
        let radius = shape == .circle ? size / 2 : size * 0.08
        ZStack {
            Ink.paper
            if let imageURL {
                AsyncImage(url: imageURL) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    ProgressView()
                }
            } else {
                Text(emoji).font(.system(size: size * 0.46))
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: radius))
        .overlay(RoundedRectangle(cornerRadius: radius).stroke(Ink.paperLip, lineWidth: 0.5))
    }
}

/// Closes a modal screen. (iPhone users can also swipe down.)
struct CloseButton: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Button {
            dismiss()
        } label: {
            Text("✕")
                .textStyle(.smallBold)
                .frame(width: 36, height: 36)
                .background(Palette.backgroundElement, in: Circle())
        }
        .buttonStyle(PressedOpacity())
        .accessibilityLabel("Close")
    }
}

struct EmptyState: View {
    let emoji: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: Spacing.two) {
            Text(emoji).font(.system(size: 40))
            Text(title).textStyle(.smallBold)
            Text(message).textStyle(.small, color: Palette.textSecondary)
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
        .padding(Spacing.five)
        .background(Palette.backgroundElement, in: RoundedRectangle(cornerRadius: Spacing.four))
    }
}

/// Smudge's speech bubble.
struct SpeechBubble: View {
    let text: String
    var maxWidth: CGFloat = 280

    var body: some View {
        Text(text)
            .textStyle(.small)
            .multilineTextAlignment(.center)
            .padding(.horizontal, Spacing.three)
            .padding(.vertical, Spacing.two)
            .background(Palette.backgroundElement, in: RoundedRectangle(cornerRadius: Spacing.four))
            .frame(maxWidth: maxWidth)
    }
}

/// Scrollable page with the app's padding and paper background.
struct Screen<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.four) {
                content
            }
            .padding(.horizontal, Spacing.four)
            .padding(.vertical, Spacing.three)
        }
        .background(Palette.background)
    }
}

// MARK: - Buttons

struct PressedOpacity: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.opacity(configuration.isPressed ? 0.7 : 1)
    }
}

struct PressedScale: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.1), value: configuration.isPressed)
    }
}

/// Big black ink button.
struct PrimaryButton: View {
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Palette.background)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.three + Spacing.one)
                .background(Palette.text, in: RoundedRectangle(cornerRadius: Spacing.four))
        }
        .buttonStyle(PressedScale())
    }
}

/// Grey pencil button.
struct SecondaryButton: View {
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .textStyle(.smallBold)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.three)
                .background(Palette.backgroundElement, in: RoundedRectangle(cornerRadius: Spacing.four))
        }
        .buttonStyle(PressedScale())
    }
}

/// Duolingo-style button with a darker lip underneath that it sinks into when pressed.
struct LipButtonStyle: ButtonStyle {
    var color: Color = Ink.ink
    var lip: Color = Ink.inkLip
    var cornerRadius: CGFloat = 14
    var depth: CGFloat = 4

    func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed
        configuration.label
            .frame(maxWidth: .infinity)
            .background(color, in: RoundedRectangle(cornerRadius: cornerRadius))
            .offset(y: pressed ? depth : 0)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(lip)
                    .offset(y: depth)
            )
            .padding(.bottom, depth)
    }
}
