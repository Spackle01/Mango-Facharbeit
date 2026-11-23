import UIKit
import WebKit

// Zeigt die Oberfläche von Mango. Der Server läuft als Node.js im selben Prozess (nodejs-mobile) und lauscht nur auf
// 127.0.0.1. Dateien, die die Oberfläche herunterlädt (Word, PDF, ZIP …), werden über „Teilen“ angeboten.
final class ViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    private let port = 47831
    private var webView: WKWebView!
    private let statusLabel = UILabel()
    private let spinner = UIActivityIndicatorView(style: .large)
    private var datenOrdner: URL!
    private var serverAdresse: URL?
    private var downloadZiel: URL?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        let konfiguration = WKWebViewConfiguration()
        konfiguration.websiteDataStore = .default()
        webView = WKWebView(frame: .zero, configuration: konfiguration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isHidden = true
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)

        statusLabel.text = "Mango startet …"
        statusLabel.textAlignment = .center
        statusLabel.numberOfLines = 0
        statusLabel.font = .preferredFont(forTextStyle: .body)
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        spinner.translatesAutoresizingMaskIntoConstraints = false
        spinner.startAnimating()
        view.addSubview(statusLabel)
        view.addSubview(spinner)

        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            spinner.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -30),
            statusLabel.topAnchor.constraint(equalTo: spinner.bottomAnchor, constant: 16),
            statusLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 32),
            statusLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -32),
        ])

        let fm = FileManager.default
        let support = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        datenOrdner = support.appendingPathComponent("Mango-Facharbeit", isDirectory: true)
        try? fm.createDirectory(at: datenOrdner, withIntermediateDirectories: true)

        starteNode()
        wartePlusAufServer(seit: Date())
    }

    // MARK: Node.js

    private func starteNode() {
        guard let skript = Bundle.main.path(forResource: "main", ofType: "js", inDirectory: "nodejs-project") else {
            zeigeFehler("Das Startskript von Mango fehlt in der App.")
            return
        }
        let argumente = ["node", skript, datenOrdner.path, NSHomeDirectory(), String(port)]
        let faden = Thread {
            NodeRunner.startEngine(withArguments: argumente)
        }
        faden.name = "node"
        faden.stackSize = 4 * 1024 * 1024
        faden.start()
    }

    // Das Startskript schreibt `laeuft.txt` (Adresse) oder `fehler.txt` (Meldung) in den Datenordner.
    private func wartePlusAufServer(seit start: Date) {
        let laeuft = datenOrdner.appendingPathComponent("laeuft.txt")
        let fehler = datenOrdner.appendingPathComponent("fehler.txt")
        if let text = try? String(contentsOf: fehler, encoding: .utf8), !text.isEmpty {
            zeigeFehler("Mango konnte nicht starten:\n\n" + String(text.prefix(1200)))
            return
        }
        if let text = try? String(contentsOf: laeuft, encoding: .utf8),
           let url = URL(string: text.trimmingCharacters(in: .whitespacesAndNewlines)) {
            serverAdresse = url
            webView.load(URLRequest(url: url))
            return
        }
        if Date().timeIntervalSince(start) > 90 {
            zeigeFehler("Mango antwortet nicht. Beende die App und starte sie neu.")
            return
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self] in self?.wartePlusAufServer(seit: start) }
    }

    private func zeigeFehler(_ text: String) {
        spinner.stopAnimating()
        statusLabel.text = text
        webView.isHidden = true
    }

    // MARK: Navigation

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.isHidden = false
        spinner.stopAnimating()
        statusLabel.isHidden = true
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        zeigeFehler("Die Oberfläche konnte nicht geladen werden: " + error.localizedDescription)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        zeigeFehler("Die Oberfläche konnte nicht geladen werden: " + error.localizedDescription)
    }

    private func gehoertZuMango(_ url: URL?) -> Bool {
        guard let url = url else { return false }
        return url.host == "127.0.0.1" && url.port == serverAdresse?.port
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if navigationAction.shouldPerformDownload {
            decisionHandler(.download)
            return
        }
        if let url = navigationAction.request.url, !gehoertZuMango(url), ["http", "https", "mailto"].contains(url.scheme ?? "") {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    // Antworten, die der Server als Anhang schickt (Content-Disposition: attachment) oder die WebKit nicht anzeigen kann,
    // werden geladen und danach über „Teilen“ angeboten.
    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        let anhang = (navigationResponse.response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Disposition")?.lowercased().hasPrefix("attachment") ?? false
        if anhang || !navigationResponse.canShowMIMEType {
            decisionHandler(.download)
        } else {
            decisionHandler(.allow)
        }
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    // Links mit target="_blank" (z. B. „Datei ansehen“): Dateien von Mango werden geladen und geteilt, andere Adressen öffnet Safari.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            if gehoertZuMango(url) {
                webView.load(URLRequest(url: url))
            } else {
                UIApplication.shared.open(url)
            }
        }
        return nil
    }

    // MARK: Downloads

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let ordner = FileManager.default.temporaryDirectory.appendingPathComponent("Downloads-\(UUID().uuidString)", isDirectory: true)
        try? FileManager.default.createDirectory(at: ordner, withIntermediateDirectories: true)
        let name = suggestedFilename.isEmpty ? "Datei" : suggestedFilename
        let ziel = ordner.appendingPathComponent(name)
        downloadZiel = ziel
        completionHandler(ziel)
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard let datei = downloadZiel else { return }
        teile(datei)
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        let meldung = UIAlertController(title: "Download fehlgeschlagen", message: error.localizedDescription, preferredStyle: .alert)
        meldung.addAction(UIAlertAction(title: "OK", style: .default))
        present(meldung, animated: true)
    }

    private func teile(_ datei: URL) {
        let teilen = UIActivityViewController(activityItems: [datei], applicationActivities: nil)
        if let popover = teilen.popoverPresentationController {
            popover.sourceView = view
            popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
            popover.permittedArrowDirections = []
        }
        present(teilen, animated: true)
    }

    // JavaScript-Dialoge (alert, confirm) der Oberfläche
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Abbrechen", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(a, animated: true)
    }
}
