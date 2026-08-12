"""Password hashing round-trip (no DB)."""

from copilot.api.security import hash_password, verify_password


def test_hash_verifies_and_rejects():
    h = hash_password("correct horse battery staple")
    assert h != "correct horse battery staple"  # stored value is a hash
    assert verify_password("correct horse battery staple", h) is True
    assert verify_password("wrong password", h) is False


def test_two_hashes_of_same_password_differ():
    # bcrypt salts each hash, so identical passwords produce different hashes.
    assert hash_password("same") != hash_password("same")
