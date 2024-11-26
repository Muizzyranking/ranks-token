;; Ranks Token (RANKS)
;; A SIP-010 compliant fungible token

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-token-owner (err u101))
(define-constant err-insufficient-balance (err u102))
(define-constant err-not-authorized (err u103))
(define-constant err-paused (err u104))
(define-constant err-not-paused (err u105))
(define-constant err-exceed-max-supply (err u106))
(define-constant err-blacklisted (err u107))
(define-constant err-zero-amount (err u108))

;; Data Variables
(define-data-var token-uri (string-utf8 256) u"")
(define-data-var total-supply uint u0)
(define-data-var contract-paused bool false)
(define-data-var max-supply uint u1000000000000) ;; 1 billion tokens with 6 decimals
(define-data-var treasury-address principal contract-owner)

;; SIP-010 Trait Implementation
(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

;; Storage
(define-map balances principal uint)
(define-map authorized-minters principal bool)
(define-map blacklisted principal bool)
(define-map allowances {owner: principal, spender: principal} uint)

;; Private Functions
(define-private (is-contract-owner)
    (is-eq tx-sender contract-owner))

(define-private (transfer-helper (amount uint) (sender principal) (recipient principal))
    (let
        (
            (sender-balance (default-to u0 (map-get? balances sender)))
            (recipient-balance (default-to u0 (map-get? balances recipient)))
        )
        (asserts! (>= sender-balance amount) err-insufficient-balance)
        (map-set balances sender (- sender-balance amount))
        (map-set balances recipient (+ recipient-balance amount))
        (ok true)
    )
)

(define-private (is-authorized-minter (account principal))
    (default-to false (map-get? authorized-minters account)))

(define-private (is-blacklisted (account principal))
    (default-to false (map-get? blacklisted account)))

;; Public Functions
(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
    (begin
        (asserts! (is-eq tx-sender sender) err-not-token-owner)
        (match (transfer-helper amount sender recipient)
            success (begin
                (print memo)
                (ok true))
            error error
        )
    )
)

(define-public (mint (amount uint) (recipient principal))
    (begin
        (asserts! (or (is-contract-owner) (is-authorized-minter tx-sender)) err-not-authorized)
        (asserts! (not (var-get contract-paused)) err-paused)
        (asserts! (not (is-blacklisted recipient)) err-blacklisted)
        (asserts! (> amount u0) err-zero-amount)
        (asserts! (<= (+ (var-get total-supply) amount) (var-get max-supply)) err-exceed-max-supply)
        (try! (transfer-helper amount contract-owner recipient))
        (var-set total-supply (+ (var-get total-supply) amount))
        (ok true))
)

(define-public (burn (amount uint) (owner principal))
    (begin
        (asserts! (is-contract-owner) err-owner-only)
        (try! (transfer-helper amount owner contract-owner))
        (var-set total-supply (- (var-get total-supply) amount))
        (ok true)
    )
)

;; New Administrative Functions
(define-public (set-max-supply (new-max-supply uint))
    (begin
        (asserts! (is-contract-owner) err-owner-only)
        (asserts! (>= new-max-supply (var-get total-supply)) err-exceed-max-supply)
        (var-set max-supply new-max-supply)
        (ok true)))

(define-public (set-treasury (new-treasury principal))
    (begin
        (asserts! (is-contract-owner) err-owner-only)
        (var-set treasury-address new-treasury)
        (ok true)))

(define-public (add-authorized-minter (minter principal))
    (begin
        (asserts! (is-contract-owner) err-owner-only)
        (map-set authorized-minters minter true)
        (ok true)))

(define-public (remove-authorized-minter (minter principal))
    (begin
        (asserts! (is-contract-owner) err-owner-only)
        (map-delete authorized-minters minter)
        (ok true)))

;; Blacklist Management
(define-public (add-to-blacklist (account principal))
    (begin
        (asserts! (is-contract-owner) err-owner-only)
        (map-set blacklisted account true)
        (ok true)))

(define-public (remove-from-blacklist (account principal))
    (begin
        (asserts! (is-contract-owner) err-owner-only)
        (map-delete blacklisted account)
        (ok true)))

;; Pause/Unpause Functions
(define-public (pause-contract)
    (begin
        (asserts! (is-contract-owner) err-owner-only)
        (asserts! (not (var-get contract-paused)) err-paused)
        (var-set contract-paused true)
        (ok true)))

(define-public (unpause-contract)
    (begin
        (asserts! (is-contract-owner) err-owner-only)
        (asserts! (var-get contract-paused) err-not-paused)
        (var-set contract-paused false)
        (ok true)))

;; Enhanced Transfer Functions
(define-public (approve (spender principal) (amount uint))
    (begin
        (asserts! (not (is-blacklisted tx-sender)) err-blacklisted)
        (asserts! (not (is-blacklisted spender)) err-blacklisted)
        (asserts! (> amount u0) err-zero-amount)
        (map-set allowances {owner: tx-sender, spender: spender} amount)
        (ok true)))

(define-public (transfer-from (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
    (begin
        (asserts! (not (var-get contract-paused)) err-paused)
        (asserts! (not (is-blacklisted sender)) err-blacklisted)
        (asserts! (not (is-blacklisted recipient)) err-blacklisted)
        (asserts! (not (is-blacklisted tx-sender)) err-blacklisted)
        (asserts! (> amount u0) err-zero-amount)
        
        (let ((current-allowance (default-to u0 (map-get? allowances {owner: sender, spender: tx-sender}))))
            (asserts! (>= current-allowance amount) err-insufficient-balance)
            (map-set allowances {owner: sender, spender: tx-sender} (- current-allowance amount))
            (try! (transfer-helper amount sender recipient))
            (print memo)
            (ok true))))

;; Read-Only Functions
(define-read-only (get-name)
    (ok "Ranks Token"))

(define-read-only (get-symbol)
    (ok "RANKS"))

(define-read-only (get-decimals)
    (ok u6))

(define-read-only (get-balance (who principal))
    (ok (default-to u0 (map-get? balances who))))

(define-read-only (get-total-supply)
    (ok (var-get total-supply)))

(define-read-only (get-token-uri)
    (ok (some (var-get token-uri))))

(define-read-only (get-allowance (owner principal) (spender principal))
    (ok (default-to u0 (map-get? allowances {owner: owner, spender: spender}))))

(define-read-only (get-max-supply)
    (ok (var-get max-supply)))

(define-read-only (is-paused)
    (ok (var-get contract-paused)))

(define-read-only (check-blacklisted (account principal))
    (ok (is-blacklisted account)))

(define-read-only (check-authorized-minter (account principal))
    (ok (is-authorized-minter account)))

(define-read-only (get-treasury)
    (ok (var-get treasury-address))) 