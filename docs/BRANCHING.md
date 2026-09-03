# Engineering change policy

Production changes should be developed on a dedicated branch and merged through a pull request when they affect runtime behavior. Small documentation or test-only changes may be committed directly when safe.

For reliability work, every behavior change should include a regression test or an explicit reason why an integration test is not practical.
