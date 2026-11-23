import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    private var hintergrundAufgabe: UIBackgroundTaskIdentifier = .invalid

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let fenster = UIWindow(frame: UIScreen.main.bounds)
        fenster.rootViewController = ViewController()
        fenster.makeKeyAndVisible()
        window = fenster
        return true
    }

    // Im Hintergrund hält iOS die App an. Eine laufende Antwort bekommt noch etwas Zeit, um fertig zu werden.
    func applicationDidEnterBackground(_ application: UIApplication) {
        hintergrundAufgabe = application.beginBackgroundTask(withName: "Mango-Antwort") { [weak self] in
            guard let self = self else { return }
            application.endBackgroundTask(self.hintergrundAufgabe)
            self.hintergrundAufgabe = .invalid
        }
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        if hintergrundAufgabe != .invalid {
            application.endBackgroundTask(hintergrundAufgabe)
            hintergrundAufgabe = .invalid
        }
    }
}
