import SwiftUI

/// Pull down past this distance (pt), or flick faster than this (pt/s), to open the archive.
private let openDistance: CGFloat = 110
private let openVelocity: CGFloat = 700
private let rubberLimit: CGFloat = 320

/// Rubber-band resistance: follows the finger at first, then stiffens.
private func rubberBand(_ offset: CGFloat) -> CGFloat {
    let distance = abs(offset)
    let resisted = (1 - 1 / ((distance * 0.55) / rubberLimit + 1)) * rubberLimit
    return offset < 0 ? -resisted : resisted
}

// The streak screen shows once per app launch.
@MainActor private var streakShownThisLaunch = false

/// Home is all about today's prompt. The sketch archive lives "above" it: pull down
/// (or tap the hint at the top edge) to open it.
/// Ported from mobile/src/app/(tabs)/index.tsx.
struct HomeView: View {
    private let days = History.get()
    private var streak: Int { History.streak(days) }
    private var today: Day? { days.first { $0.status == .today } }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var drag: CGFloat = 0
    @State private var menuOpen = false

    @State private var showStreak = false
    @State private var showArchive = false
    @State private var showSession = false
    @State private var showJourney = false
    /// Set by the streak screen's "See past sketches": open the archive once it closes.
    @State private var archiveAfterStreak = false

    var body: some View {
        VStack(spacing: Spacing.four) {
            archiveHint
                .padding(.bottom, -Spacing.two)
            topBar

            VStack(spacing: Spacing.three) {
                Smudge(size: 150, animated: true)
                SpeechBubble(text: "Morning! Five minutes, any paper. You’ve got this.")
            }
            .frame(maxHeight: .infinity)

            promptCard

            Button {
                showSession = true
            } label: {
                HStack(spacing: Spacing.two) {
                    Text("+").font(.system(size: 26, weight: .medium))
                    Text("Snap my sketch").font(.system(size: 18, weight: .bold))
                }
                .foregroundStyle(Palette.background)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.three + Spacing.one)
                .background(Palette.text, in: RoundedRectangle(cornerRadius: Spacing.four))
            }
            .buttonStyle(PressedScale())
        }
        .padding(.horizontal, Spacing.four)
        .padding(.top, Spacing.one)
        .padding(.bottom, Spacing.four)
        .offset(y: drag)
        .contentShape(Rectangle())
        .gesture(pullDown)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Palette.background)
        .overlay(alignment: .topTrailing) { menu }
        .onAppear {
            // On landing, celebrate the streak first.
            if !streakShownThisLaunch {
                streakShownThisLaunch = true
                showStreak = true
            }
        }
        .sheet(isPresented: $showSession) { SessionView() }
        .sheet(isPresented: $showJourney) { JourneyView() }
        .fullScreen(isPresented: $showStreak, onDismiss: {
            if archiveAfterStreak {
                archiveAfterStreak = false
                showArchive = true
            }
        }) {
            StreakView(onSeePast: {
                archiveAfterStreak = true
                showStreak = false
            })
        }
        .fullScreen(isPresented: $showArchive) { ArchiveView() }
    }

    // MARK: Pieces

    /// Archive hint on the top edge; pull down or tap. Wakes up as you pull.
    private var archiveHint: some View {
        let progress = min(1, drag / (openDistance * 0.6))
        return Button(action: openArchive) {
            VStack(spacing: 0) {
                Text("Sketch archive").textStyle(.small, color: Palette.textSecondary)
                Text("﹀").font(.system(size: 18, weight: .bold)).foregroundStyle(Palette.text)
            }
            .opacity(0.55 + 0.45 * progress)
            .offset(y: 6 * progress)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Open sketch archive")
        .accessibilityHint("Or pull down")
    }

    private var topBar: some View {
        HStack {
            Button { showStreak = true } label: { pill("🔥 \(streak)") }
                .buttonStyle(PressedOpacity())
                .accessibilityLabel("\(streak) day streak")
            Spacer()
            Text(History.weekdayDate(.now)).textStyle(.smallBold, color: Palette.textSecondary)
            Spacer()
            Button {
                withAnimation(.easeOut(duration: 0.15)) { menuOpen.toggle() }
            } label: { pill("•••") }
                .buttonStyle(PressedOpacity())
                .accessibilityLabel("Menu")
        }
    }

    private func pill(_ text: String) -> some View {
        Text(text)
            .textStyle(.smallBold)
            .padding(.horizontal, Spacing.three)
            .frame(height: 36)
            .background(Palette.backgroundElement, in: Capsule())
    }

    private var promptCard: some View {
        VStack(alignment: .leading, spacing: Spacing.two) {
            Text("Today’s prompt").textStyle(.small, color: Palette.textSecondary)
            Text(today?.prompt.text ?? "").textStyle(.subtitle)
        }
        .frame(maxWidth: .infinity, minHeight: 150, alignment: .leading)
        .padding(Spacing.four)
        .background(Palette.backgroundElement, in: RoundedRectangle(cornerRadius: Spacing.four))
    }

    @ViewBuilder private var menu: some View {
        if menuOpen {
            ZStack(alignment: .topTrailing) {
                // Tap anywhere else to close.
                Color.black.opacity(0.001)
                    .ignoresSafeArea()
                    .onTapGesture { withAnimation(.easeOut(duration: 0.12)) { menuOpen = false } }

                VStack(alignment: .leading, spacing: 0) {
                    menuItem("🗺️  My sketch path") { showJourney = true }
                    menuItem("🗂️  Sketch archive") { openArchive() }
                }
                .padding(.vertical, Spacing.one)
                .frame(minWidth: 200, alignment: .leading)
                .background(Palette.background, in: RoundedRectangle(cornerRadius: 16))
                .shadow(color: .black.opacity(0.12), radius: 12, y: 8)
                .padding(.top, 86)
                .padding(.trailing, Spacing.four)
            }
            .transition(.opacity)
        }
    }

    private func menuItem(_ label: String, action: @escaping () -> Void) -> some View {
        Button {
            menuOpen = false
            action()
        } label: {
            Text(label)
                .textStyle(.smallBold)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(Spacing.three)
                .contentShape(Rectangle())
        }
        .buttonStyle(PressedOpacity())
    }

    // MARK: Pull to open the archive

    private var pullDown: some Gesture {
        DragGesture(minimumDistance: 12)
            .onChanged { value in
                guard !reduceMotion, abs(value.translation.width) < 24 else { return }
                drag = rubberBand(max(0, value.translation.height))
            }
            .onEnded { value in
                let velocity = value.predictedEndTranslation.height - value.translation.height
                if value.translation.height > openDistance || velocity * 4 > openVelocity {
                    openArchive()
                }
                withAnimation(.spring(duration: 0.4, bounce: 0.2)) { drag = 0 }
            }
    }

    private func openArchive() {
        Haptics.light()
        showArchive = true
    }
}

#Preview {
    HomeView()
}
