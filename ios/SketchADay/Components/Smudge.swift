import SwiftUI

/// - happy: default
/// - focus: watching you draw (eyes down, flat mouth)
/// - hurry: time is nearly up (little "o" mouth, sweat drop)
/// - proud: done or overtime (happy closed eyes, big smile)
enum SmudgeMood {
    case happy, focus, hurry, proud
}

private enum SmudgeColors {
    static let body = Color(hex: 0x2A2A2A)
    static let bodyShade = Color(hex: 0x161616)
    static let belly = Color(hex: 0x3A3A3A)
    static let sheen = Color.white.opacity(0.16)
    static let eyeWhite = Color.white
    static let pupil = Color(hex: 0x161616)
    static let blush = Color(red: 1, green: 130 / 255, blue: 150 / 255, opacity: 0.45)
    static let mouth = Color.white
    static let shadow = Color.black.opacity(0.12)
    static let sweat = Color(hex: 0x9CD3F0)
}

/// Smudge, the mascot (placeholder design): a squishy ball of graphite, like a pencil
/// smudge come to life, with big white eyes and a curl of pencil shaving on top.
/// Drawn with shapes, so it scales to any size and needs no image assets.
/// Ported from mobile/src/components/smudge.tsx.
struct Smudge: View {
    var size: CGFloat = 140
    var mood: SmudgeMood = .happy
    /// Gentle breathing and blinking. Off when the user prefers reduced motion.
    var animated = false

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let live = animated && !reduceMotion
        TimelineView(.animation(paused: !live)) { context in
            let t = live ? context.date.timeIntervalSinceReferenceDate : 0
            figure(breathe: breathe(t), blink: blink(t))
        }
        .frame(width: size, height: size * 1.12)
        .accessibilityElement()
        .accessibilityLabel("Smudge")
    }

    /// 2.8 s ease-in-out squash: (scaleX, scaleY).
    private func breathe(_ t: Double) -> (CGFloat, CGFloat) {
        let phase = (1 - cos(t.truncatingRemainder(dividingBy: 2.8) / 2.8 * 2 * .pi)) / 2
        return (1 + 0.02 * phase, 1 - 0.035 * phase)
    }

    /// 4.2 s loop with a quick blink near the end: eye scaleY.
    private func blink(_ t: Double) -> CGFloat {
        let p = t.truncatingRemainder(dividingBy: 4.2) / 4.2
        if p < 0.93 { return 1 }
        if p < 0.96 { return 1 - 0.9 * (p - 0.93) / 0.03 }
        return 0.1 + 0.9 * (p - 0.96) / 0.04
    }

    private func figure(breathe: (CGFloat, CGFloat), blink: CGFloat) -> some View {
        let s = size
        let stroke = max(2, s * 0.02)

        return ZStack(alignment: .topLeading) {
            // Ground shadow stays put while the body breathes.
            Capsule()
                .fill(SmudgeColors.shadow)
                .frame(width: s * 0.7, height: s * 0.07)
                .offset(x: s * 0.15, y: s * 1.12 - s * 0.07)

            ZStack(alignment: .topLeading) {
                // Pencil-shaving curl
                RoundedRectangle(cornerRadius: s * 0.06)
                    .fill(SmudgeColors.bodyShade)
                    .frame(width: s * 0.1, height: s * 0.16)
                    .rotationEffect(.degrees(-18))
                    .offset(x: s * 0.44, y: s * 0.02)
                RoundedRectangle(cornerRadius: s * 0.05)
                    .fill(SmudgeColors.body)
                    .frame(width: s * 0.08, height: s * 0.12)
                    .rotationEffect(.degrees(22))
                    .offset(x: s * 0.5, y: s * 0.05)

                // Feet
                ForEach([0.3, 0.56], id: \.self) { x in
                    RoundedRectangle(cornerRadius: s * 0.05)
                        .fill(SmudgeColors.bodyShade)
                        .frame(width: s * 0.14, height: s * 0.08)
                        .offset(x: s * x, y: s * 1.12 - s * 0.03 - s * 0.08)
                }

                bodyShape(stroke: stroke, blink: blink)
                    .offset(y: s * 0.12)

                // Sweat drop when time is nearly up
                if mood == .hurry {
                    UnevenRoundedRectangle(
                        topLeadingRadius: s, bottomLeadingRadius: s,
                        bottomTrailingRadius: s, topTrailingRadius: 0
                    )
                    .fill(SmudgeColors.sweat)
                    .frame(width: s * 0.09, height: s * 0.12)
                    .rotationEffect(.degrees(-45))
                    .offset(x: s - s * 0.02 - s * 0.09, y: s * 0.2)
                }
            }
            .frame(width: s, height: s * 1.12, alignment: .topLeading)
            .scaleEffect(x: breathe.0, y: breathe.1, anchor: .bottom)
        }
        .frame(width: s, height: s * 1.12, alignment: .topLeading)
    }

    private func bodyShape(stroke: CGFloat, blink: CGFloat) -> some View {
        let s = size
        let bodyW = s
        let bodyH = s * 0.9
        let eyeW = s * 0.17
        let eyeH = s * 0.19
        let pupil = mood == .hurry ? s * 0.08 : s * 0.1
        let pupilOffset = mood == .focus ? eyeH * 0.12 : -eyeH * 0.12
        let mouthW = mood == .proud ? s * 0.16 : s * 0.11

        return ZStack(alignment: .topLeading) {
            Ellipse().fill(SmudgeColors.body)

            // Darker graphite on the lower right
            Ellipse()
                .fill(SmudgeColors.bodyShade.opacity(0.6))
                .frame(width: s * 0.8, height: s * 0.6)
                .offset(x: bodyW - s * 0.8 + s * 0.12, y: bodyH - s * 0.6 + s * 0.16)

            // Belly
            Ellipse()
                .fill(SmudgeColors.belly)
                .frame(width: s * 0.48, height: s * 0.3)
                .offset(x: s * 0.26, y: bodyH - s * 0.07 - s * 0.3)

            // Pencil sheen, like light catching graphite
            Capsule()
                .fill(SmudgeColors.sheen)
                .frame(width: s * 0.22, height: s * 0.08)
                .rotationEffect(.degrees(-28))
                .offset(x: s * 0.14, y: s * 0.09)

            // Eyes
            ForEach([0.25, 0.58], id: \.self) { x in
                if mood == .proud {
                    // Happy closed eyes: little arches.
                    Arch()
                        .stroke(SmudgeColors.eyeWhite, style: StrokeStyle(lineWidth: stroke * 1.4, lineCap: .round))
                        .frame(width: eyeW, height: eyeW / 2)
                        .offset(x: s * x, y: s * 0.32)
                } else {
                    ZStack {
                        Ellipse().fill(SmudgeColors.eyeWhite)
                        Ellipse()
                            .fill(SmudgeColors.pupil)
                            .frame(width: pupil, height: pupil * 1.1)
                            .overlay(alignment: .topLeading) {
                                Circle()
                                    .fill(.white)
                                    .frame(width: pupil * 0.36, height: pupil * 0.36)
                                    .offset(x: pupil * 0.18, y: pupil * 0.14)
                            }
                            .offset(y: pupilOffset / 2)
                    }
                    .frame(width: eyeW, height: eyeH)
                    .scaleEffect(x: 1, y: blink)
                    .offset(x: s * x, y: s * 0.26)
                }
            }

            // Blush
            ForEach([0.12, 0.72], id: \.self) { x in
                Capsule()
                    .fill(SmudgeColors.blush)
                    .frame(width: s * 0.16, height: s * 0.07)
                    .offset(x: s * x, y: s * 0.47)
            }

            // Mouth
            switch mood {
            case .focus:
                Capsule()
                    .fill(SmudgeColors.mouth)
                    .frame(width: mouthW * 0.8, height: stroke)
                    .offset(x: (bodyW - mouthW * 0.8) / 2, y: s * 0.52)
            case .hurry:
                Ellipse()
                    .stroke(SmudgeColors.mouth, lineWidth: stroke)
                    .frame(width: s * 0.07, height: s * 0.08)
                    .offset(x: (bodyW - s * 0.07) / 2, y: s * 0.49)
            case .happy, .proud:
                Smile()
                    .stroke(SmudgeColors.mouth, style: StrokeStyle(lineWidth: stroke, lineCap: .round))
                    .frame(width: mouthW, height: mouthW / 2)
                    .offset(x: (bodyW - mouthW) / 2, y: s * 0.48)
            }
        }
        .frame(width: bodyW, height: bodyH, alignment: .topLeading)
        .clipShape(Ellipse())
    }
}

/// Upper half of an ellipse (closed happy eye).
private struct Arch: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.minX, y: rect.maxY))
        p.addCurve(
            to: CGPoint(x: rect.maxX, y: rect.maxY),
            control1: CGPoint(x: rect.minX, y: rect.minY - rect.height * 0.3),
            control2: CGPoint(x: rect.maxX, y: rect.minY - rect.height * 0.3)
        )
        return p
    }
}

/// Lower half of an ellipse (smile).
private struct Smile: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.minX, y: rect.minY))
        p.addCurve(
            to: CGPoint(x: rect.maxX, y: rect.minY),
            control1: CGPoint(x: rect.minX, y: rect.maxY + rect.height * 0.3),
            control2: CGPoint(x: rect.maxX, y: rect.maxY + rect.height * 0.3)
        )
        return p
    }
}

#Preview {
    HStack {
        Smudge(size: 80, mood: .happy, animated: true)
        Smudge(size: 80, mood: .focus)
        Smudge(size: 80, mood: .hurry)
        Smudge(size: 80, mood: .proud)
    }
    .padding()
    .background(Palette.background)
}
