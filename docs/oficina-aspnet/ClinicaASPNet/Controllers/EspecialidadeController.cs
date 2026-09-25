using ClinicaASPNet.Data;
using ClinicaASPNet.Services;
using ClinicaASPNet.ViewModels;
using Microsoft.AspNetCore.Mvc;
using System.Runtime.CompilerServices;

namespace ClinicaASPNet.Controllers
{
    public class EspecialidadeController : Controller
    {

        private ClinicaDbContext _context;
        private EspecialidadeService _service;


        public EspecialidadeController(ClinicaDbContext context)
        {
            _context = context;
            _service = new EspecialidadeService(context);
        }


        public async Task<IActionResult> Index()
        {
            return View(await _service.ListarTodosAsync());
        }

        [HttpGet]
        public async Task<IActionResult> Create()
        {
            return View();
        }

        [HttpPost]
        public async Task<IActionResult> Create(EspecialidadeViewModel especialidadeVM)
        {
            if (!ModelState.IsValid)
            {
                return View(especialidadeVM);
            }
            await _service.AdicionarAsync(especialidadeVM);
            TempData["Mensagem"] = "Especialidade Cadastrada com sucesso";
            return RedirectToAction("Index");

        }
    }
}
