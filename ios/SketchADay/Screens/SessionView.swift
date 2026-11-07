import SwiftUI

private let durations = [2, 5, 10] // minutes

private func formatClock(_ totalSeconds: Double) -> String {
    let s = max(0, Int(totalSeconds))
    return "\(s / 60):\(String(format: "%02d", s % 60))"
}

/// Sketch session, opened from "+ Snap my sketch": pick a time, sketch while Smudge
/// watches, keep going past the timer if you like, then scan the paper.
/// Ported from mobile/src/app/session.tsx.
struct SessionView: View {
    private enum Phase { case setup, running, paused, done }

    @Environment(\.dismiss) private var dismiss
    private let prompt = Prompts.forDate()

    @State private var minutes = 5
    @State private var phase: Phase = .setup
    // Elapsed time is tracked from timestamps so it stays accurate if the app stalls.
    @State private var elapsedBefore: TimeInterval = 0 // banked before the current run
    @State private var runStartedAt: Date?
    @State private var now = Date()
    // One nudge with a minute left, one when time is up. Never more.
    @State private var nudgedMinute = false
    @State private var nudgedUp = false
    @State private var comingSoon: String?

    private let tick = Timer.publish(every: 0.25, on: .main, in: .common).autoconnect()

    private var elapsed: TimeInterval {
        elapsedBefore + (runStartedAt.map { now.timeIntervalSince($0) } ?? 0)
    }
    private var total: TimeInterval { Double(minutes * 60) }
    private var remaining: TimeInterval { total - elapsed }
    private var overtime: Bool { elapsed > total }
    private var progress: Double { min(1, elapsed / total) }

    private var moodAndLine: (SmudgeMood, String) {
        switch phase {
        case .setup:
            return (.happy, "Ready when you are. Grab any paper and a pencil!")
        case .done:
            return (.proud, "You sketched for \(formatClock(elapsed)). Let’s see it!")
        case .running, .paused:
            if overtime { return (.proud, "Time’s up — but keep going if you’re in the zone!") }
            if remaining <= total * 0.25 { return (.hurry, "Almost there! Don’t worry about the details.") }
            return (.focus, phase == .paused ? "Taking a breather. I’ll wait." : "Ooh, I can hear the pencil…")
        }
    }

    var body: some View {
        let (mood, line) = moodAndLine

        VStack(spacing: Spacing.four) {
            HStack(spacing: Spacing.three) {
                VStack(alignment: .leading) {
                    Text("Today’s prompt").textStyle(.small, color: Palette.textSecondary)
                    Text(prompt.text).font(.system(size: 20, weight: .bold)).foregroundStyle(Palette.text)
                }
                Spacer()
                CloseButton()
            }

            VStack(spacing: Spacing.three) {
                Smudge(size: 130, mood: mood, animated: phase != .done)
                SpeechBubble(text: line, maxWidth: 290)
            }
            .frame(maxHeight: .infinity)

            timerBlock
            actions
        }
        .padding(.horizontal, Spacing.four)
        .padding(.vertical, Spacing.three)
        .background(Palette.background)
        .onReceive(tick) { date in
            guard phase == .running else { return }
            now = date
            checkNudges()
        }
        .alert("Coming soon", isPresented: Binding(
            get: { comingSoon != nil },
            set: { if !$0 { comingSoon = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("\(comingSoon ?? "") isn't built yet.")
        }
    }

    // MARK: Timer

    private var timerBlock: some View {
        VStack(spacing: Spacing.one) {
            if phase == .setup {
                HStack(spacing: Spacing.two) {
                    ForEach(durations, id: \.self) { m in
                        let selected = minutes == m
                        Button { minutes = m } label: {
                            Text("\(m) min")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(selected ? Palette.background : Palette.text)
                                .padding(.horizontal, Spacing.three)
                                .padding(.vertical, Spacing.two)
                                .background(selected ? Palette.text : Palette.backgroundElement, in: Capsule())
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(selected ? .isSelected : [])
                    }
                }
                .padding(.bottom, Spacing.two)
            }

            Text(clockText)
                .font(.system(size: 72, weight: .heavy).monospacedDigit())
                .tracking(-2)
                .foregroundStyle(overtime && phase != .done ? Ink.red : Palette.text)
                .accessibilityLabel(overtime ? "\(formatClock(elapsed - total)) extra" : "\(formatClock(remaining)) left")

            Text(caption).textStyle(.small, color: Palette.textSecondary)

            if phase != .setup {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Palette.backgroundElement)
                        Capsule()
                            .fill(overtime ? Ink.red : Palette.text)
                            .frame(width: geo.size.width * progress)
                    }
                }
                .frame(height: 6)
                .padding(.top, Spacing.three)
            }
        }
    }

    private var clockText: String {
        switch phase {
        case .setup: formatClock(total)
        case .done: formatClock(elapsed)
        default: overtime ? "+\(formatClock(elapsed - total))" : formatClock(remaining)
        }
    }

    private var caption: String {
        switch phase {
        case .setup: "Pick your time"
        case .done: "sketched — nice work"
        default: overtime ? "extra time — still counting" : (phase == .paused ? "paused" : "left")
        }
    }

    // MARK: Actions

    @ViewBuilder private var actions: some View {
        VStack(spacing: Spacing.three) {
            switch phase {
            case .setup:
                PrimaryButton(label: "Start sketching", action: start)
            case .running, .paused:
                PrimaryButton(label: "I’m done", action: finish)
                SecondaryButton(label: phase == .running ? "Pause" : "Resume") {
                    phase == .running ? pause() : resume()
                }
            case .done:
                PrimaryButton(label: "📷  Scan my sketch") { comingSoon = "Scanning" }
                SecondaryButton(label: "Choose from photos") { comingSoon = "Photo library" }
                Button("Not now") { dismiss() }
                    .textStyle(.small, color: Palette.textSecondary)
            }
        }
    }

    private func start() {
        nudgedMinute = false
        nudgedUp = false
        elapsedBefore = 0
        runStartedAt = .now
        now = .now
        phase = .running
    }

    private func pause() {
        bank()
        phase = .paused
    }

    private func resume() {
        runStartedAt = .now
        now = .now
        phase = .running
    }

    private func finish() {
        bank()
        phase = .done
    }

    private func bank() {
        if let runStartedAt { elapsedBefore += Date.now.timeIntervalSince(runStartedAt) }
        runStartedAt = nil
        now = .now
    }

    private func checkNudges() {
        if !nudgedMinute && total > 60 && remaining <= 60 {
            nudgedMinute = true
            Haptics.warning()
        }
        if !nudgedUp && remaining <= 0 {
            nudgedUp = true
            Haptics.success()
        }
    }
}

#Preview {
    SessionView()
}
