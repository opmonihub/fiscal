import unittest
from pathlib import Path

from fiscal_cli.models import FiscalDocument
from fiscal_cli.registry import Company
from fiscal_cli.routing import route_document


class CteRoutingTests(unittest.TestCase):
    def setUp(self):
        self.emitter = Company('1', '1-TRANSPORTADORA', '00000000000001')
        self.customer = Company('2', '2-CLIENTE', '00000000000002')
        self.selected = {c.cnpj: c for c in (self.emitter, self.customer)}

    def document(self, **fields):
        return FiscalDocument(Path('nota.xml'), 'hash', kind='CTE',
                              issuer=self.emitter.cnpj, **fields)

    def test_emitter_repeated_as_recipient_has_only_output(self):
        routes, issues = route_document(self.document(recipient=self.emitter.cnpj), self.selected)
        self.assertEqual([(r.company.code, r.movement) for r in routes], [('1', 'SAIDA')])
        self.assertEqual(issues, [])

    def test_emitter_repeated_as_taker_keeps_other_company_input(self):
        routes, issues = route_document(self.document(recipient=self.customer.cnpj,
                                                      taker=self.emitter.cnpj), self.selected)
        self.assertEqual({(r.company.code, r.movement) for r in routes},
                         {('1', 'SAIDA'), ('2', 'ENTRADA')})
        self.assertEqual(issues, [])

    def test_recipient_and_taker_same_customer_generate_one_input(self):
        routes, issues = route_document(self.document(recipient=self.customer.cnpj,
                                                      taker=self.customer.cnpj), self.selected)
        self.assertEqual([(r.company.code, r.movement) for r in routes].count(('2', 'ENTRADA')), 1)
        self.assertEqual(issues, [])

    def test_nonselected_emitter_does_not_create_output(self):
        routes, issues = route_document(self.document(recipient=self.customer.cnpj),
                                        {self.customer.cnpj: self.customer})
        self.assertEqual([(r.company.code, r.movement) for r in routes], [('2', 'ENTRADA')])
        self.assertEqual(issues, [])

    def test_nfe_role_conflict_stays_pending(self):
        doc = FiscalDocument(Path('nota.xml'), 'hash', kind='NFE',
                            issuer=self.emitter.cnpj, recipient=self.emitter.cnpj,
                            operation_type='1')
        routes, issues = route_document(doc, self.selected)
        self.assertEqual(routes, [])
        self.assertEqual(issues[0]['tipo'], 'papeis_fiscais_incompativeis')


if __name__ == '__main__':
    unittest.main()
