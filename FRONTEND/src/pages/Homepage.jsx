// src/pages/Home.jsx
import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../services/AuthService.jsx";
import "../styles/Home.css";

export default function Home() {
  const { user } = useAuth();
  const isLoggedIn = !!user;

  const displayName =
    user?.nombre ||
    user?.name ||
    user?.firstName ||
    user?.username ||
    user?.email ||
    "";

  return (
    <>
      <Navbar />

      <main className={`home ${isLoggedIn ? "home-logged" : "home-guest"}`}>
        <div className="backdrop" />

        <section className="hero-card" aria-label="Credencial digital">
          <div className="hand" aria-hidden />

          <h1 className="title">
            {isLoggedIn ? (
              <>
                Bienvenidos
                {displayName ? (
                  <>
                    , {displayName}
                  </>
                ) : null}
                <br />a tu Credencial Digital
              </>
            ) : (
              <>
                Bienvenido a tu
                <br />
                Credencial Digital
              </>
            )}
          </h1>

          <div className="cta">
            {!isLoggedIn ? (
              <>
                <ul className="features" />

                <p className="subtitle">
                  Seguridad con biometría y NFC · Disponible offline y online ·
                  Acceso a biblioteca, comedor, etc.
                </p>
                <p className="subtitle">
                  Accede a todos tus servicios institucionales de forma segura y
                  sencilla desde tu celular.
                </p>

                <ul className="features" />

                <div className="cta-actions">
                  <Link to="/login" className="btn primary">
                    Iniciar sesión
                  </Link>
                  <a href="/registrarse" className="btn ghost">
                    Registrarse
                  </a>
                </div>
              </>
            ) : (
              <>
                <ul className="features" />

                <div className="cta-actions">
                  <Link to="/credencial" className="btn primary">
                    Ver mi credencial
                  </Link>
                  <Link to="/novedades" className="btn">
                    Ver novedades
                  </Link>
                  <Link to="/accesos" className="btn">
                    Ver accesos
                  </Link>
                  <Link to="/perfil" className="btn ghost">
                    Editar perfil
                  </Link>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
