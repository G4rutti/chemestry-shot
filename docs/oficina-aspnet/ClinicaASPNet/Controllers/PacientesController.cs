using ClinicaASPNet.Data;
using ClinicaASPNet.Models;
using ClinicaASPNet.Repositories;
using ClinicaASPNet.ViewModels;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using System.IO.Pipelines;
using System.Reflection.Metadata.Ecma335;

namespace ClinicaASPNet.Controllers
{
    public class PacientesController : Controller
    {
        private readonly ClinicaDbContext _context;
        private readonly RepositoryPaciente _repository;

        public PacientesController(ClinicaDbContext context)
        {
            _context = context;
            _repository = new RepositoryPaciente(context);
        }

        [HttpGet]
        public async Task<IActionResult> Index(string? nome)
        {
            var listaPacientesVM = await PacienteViewModel.ListarTodos(_context);          
            
            ViewBag.NomePesquisado = nome;
            var pacientes = _repository.Listar(nome);
            return View(listaPacientesVM);
        }
        [HttpGet]
        public IActionResult Details(int id)
        {
            var paciente = _repository.SelecionarPorId(id);
            if (paciente is null) return NotFound();
            return View(paciente);
        }

        [HttpGet]
        public IActionResult Create()
        {
            return View();
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult Create(PacienteViewModel pacienteVM)
        {
            if (_repository.CpfJaCadastrado(pacienteVM.Cpf))
            {
                ModelState.AddModelError(nameof(pacienteVM.Cpf), "Ja existe um paciente" +
                    "cadastrado com esse CPF");
            }
            if (ModelState.IsValid == false)
            {
                return View(pacienteVM);
            }

            var paciente = new Paciente()
            {
                Cpf = pacienteVM.Cpf,
                DataNascimento = pacienteVM.DataNascimento,
                Nome = pacienteVM.Nome,
                Telefone = pacienteVM.Telefone
            };
            _repository.Incluir(paciente);


            TempData["MensagemSucesso"] = "Paciente cadastrado com sucesso";
            return RedirectToAction("Index");
        }

        public IActionResult Edit(int id)
        {
            var paciente = _repository.SelecionarPorId(id);
            if (paciente is null) return NotFound();
            return View(paciente);  
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult Edit(Paciente paciente, int id)
        {
            if (id != paciente.Id)
            {
                return BadRequest();
            }
            if (_repository.CpfJaCadastrado(paciente.Cpf))
            {
                ModelState.AddModelError(nameof(paciente.Cpf), "Ja existe um paciente" +
                    "cadastrado com esse CPF");
            }
            if (!ModelState.IsValid)
            {
                return View(paciente);
            }
           
              TempData["MensagemSucesso"] = "Paciente cadastrado com sucesso";
            return RedirectToAction("Index");
        }

        public string RemoverEspacoes(string nome)
        {
            return nome.Trim();
        }

        [HttpGet]
        public IActionResult Delete(int id)
        {
            var paciente = _repository.SelecionarPorId(id);
            if (paciente is null) return NotFound();
            return View(paciente);
        }

        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        public IActionResult ConfirmarExclusao(int id)
        {
            var paciente = _repository.SelecionarPorId(id);
            if (paciente != null)
            {

                _repository.Excluir(paciente);
            }
            else
            {
                return NotFound();
            }
            TempData["MensagemSucesso"] = "Paciente excluído com sucesso";
            return RedirectToAction("Index");

         }
    }
}
