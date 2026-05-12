"""
Router Import & Registration Smoke Tests
=========================================
Verifies that every router module:
  1. Can be imported without raising an exception
  2. Exposes an `APIRouter` instance named `router`
  3. Has at least one registered route

These tests are intentionally lightweight — they catch broken imports,
missing files, and circular dependency regressions within seconds.
"""

import sys
import os
import importlib
import pytest
from fastapi.routing import APIRouter

# Ensure backend package is on sys.path (conftest already does this,
# but we repeat here for clarity when running this file in isolation)
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

ROUTER_MODULES = [
    "routers.system_router",
    "routers.auth_router",
    "routers.leads_router",
    "routers.users_router",
    "routers.hospitals_router",
    "routers.courses_router",
    "routers.analytics_router",
    "routers.ai_router",
    "routers.communications_router",
    "routers.settings_router",
]


@pytest.mark.parametrize("module_path", ROUTER_MODULES)
def test_router_module_importable(module_path):
    """Each router module must import without errors."""
    try:
        mod = importlib.import_module(module_path)
    except ImportError as exc:
        pytest.fail(f"{module_path} failed to import: {exc}")
    assert mod is not None


@pytest.mark.parametrize("module_path", ROUTER_MODULES)
def test_router_has_router_attribute(module_path):
    """Each router module must expose `router = APIRouter(...)`."""
    try:
        mod = importlib.import_module(module_path)
    except ImportError:
        pytest.skip(f"Skipping — {module_path} could not be imported")

    assert hasattr(mod, "router"), f"{module_path} is missing a `router` attribute"
    assert isinstance(mod.router, APIRouter), (
        f"{module_path}.router is {type(mod.router)}, expected APIRouter"
    )


@pytest.mark.parametrize("module_path", ROUTER_MODULES)
def test_router_has_routes(module_path):
    """Each router must register at least one route."""
    try:
        mod = importlib.import_module(module_path)
    except ImportError:
        pytest.skip(f"Skipping — {module_path} could not be imported")

    if not hasattr(mod, "router"):
        pytest.skip("No router attribute")

    route_count = len(mod.router.routes)
    assert route_count > 0, (
        f"{module_path}.router has no routes — did you forget @router.get/post decorators?"
    )


class TestRouterTagsAndPrefixes:
    """Verify router metadata is present for OpenAPI docs."""

    @pytest.mark.parametrize("module_path,expected_tag", [
        ("routers.system_router",         None),              # system router may have no tags
        ("routers.auth_router",           "Authentication"),  # actual tag in auth_router.py
        ("routers.leads_router",          "Leads"),
        ("routers.users_router",          "Users"),
        ("routers.hospitals_router",      "Hospitals"),
        ("routers.courses_router",        "Courses"),
        ("routers.analytics_router",      "Analytics"),
        ("routers.ai_router",             "AI / ML"),         # actual tag in ai_router.py
        ("routers.communications_router", "Communications"),
        ("routers.settings_router",       "Settings"),
    ])
    def test_router_tag(self, module_path, expected_tag):
        """Each router should declare a tag for API docs grouping."""
        try:
            mod = importlib.import_module(module_path)
        except ImportError:
            pytest.skip(f"Cannot import {module_path}")

        if expected_tag is None:
            return  # skip tag check for system router

        if not hasattr(mod, "router"):
            pytest.skip("No router")

        tags = mod.router.tags or []
        assert expected_tag in tags, (
            f"{module_path}.router.tags={tags}, expected '{expected_tag}'"
        )


class TestRouterPackageInit:
    """Verify the routers/__init__.py is properly formed."""

    def test_routers_package_importable(self):
        import routers
        assert routers is not None

    def test_routers_package_has_docstring(self):
        import routers
        assert routers.__doc__ is not None, "routers/__init__.py should have a module docstring"
